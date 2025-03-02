// Code for authenticated inbound calls with your agent

import WebSocket from "ws";

export function registerInboundRoutes(fastify) {
  // Check for the required environment variables
  const { ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID } = process.env;

  if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID) {
    console.error("Missing required environment variables");
    throw new Error("Missing ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID");
  }

  // Helper function to get signed URL for authenticated conversations
  async function getSignedUrl() {
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${ELEVENLABS_AGENT_ID}`,
        {
          method: 'GET',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get signed URL: ${response.statusText}`);
      }

      const data = await response.json();
      return data.signed_url;
    } catch (error) {
      console.error("Error getting signed URL:", error);
      throw error;
    }
  }

  // Route to handle incoming calls from Twilio
  fastify.all("/incoming-call-eleven", async (request, reply) => {
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Connect>
          <Stream url="wss://${request.headers.host}/media-stream" />
        </Connect>
      </Response>`;

    reply.type("text/xml").send(twimlResponse);
  });

  // WebSocket route for handling media streams from Twilio
  fastify.register(async (fastifyInstance) => {
    fastifyInstance.get("/media-stream", { websocket: true }, async (connection, req) => {
      console.info("[Server] Twilio connected to media stream.");

      let streamSid = null;
      let elevenLabsWs = null;

      try {
        // Get authenticated WebSocket URL
        const signedUrl = await getSignedUrl();

        // Connect to ElevenLabs using the signed URL
        elevenLabsWs = new WebSocket(signedUrl);

        // Handle open event for ElevenLabs WebSocket
        elevenLabsWs.on("open", () => {
          console.log("[II] Connected to Conversational AI.");
        });

        // Handle messages from ElevenLabs
        elevenLabsWs.on("message", (data) => {
          try {
            const message = JSON.parse(data);
            handleElevenLabsMessage(message, connection);
          } catch (error) {
            console.error("[II] Error parsing message:", error);
          }
        });

        // Handle errors from ElevenLabs WebSocket
        elevenLabsWs.on("error", (error) => {
          console.error("[II] WebSocket error:", error);
        });

        // Handle close event for ElevenLabs WebSocket
        elevenLabsWs.on("close", () => {
          console.log("[II] Disconnected.");
        });

        // Function to handle messages from ElevenLabs
        const handleElevenLabsMessage = (message, connection) => {
          switch (message.type) {
            case "conversation_initiation_metadata":
              console.info("[II] Received conversation initiation metadata.");
              break;
            case "audio":
              if (message.audio_event?.audio_base_64) {
                const audioData = {
                  event: "media",
                  streamSid,
                  media: {
                    payload: message.audio_event.audio_base_64,
                  },
                };
                connection.send(JSON.stringify(audioData));
              }
              break;
            case "interruption":
              connection.send(JSON.stringify({ event: "clear", streamSid }));
              break;
            case "ping":
              if (message.ping_event?.event_id) {
                const pongResponse = {
                  type: "pong",
                  event_id: message.ping_event.event_id,
                };
                elevenLabsWs.send(JSON.stringify(pongResponse));
              }
              break;
          }
        };

        // Handle messages from Twilio
        connection.on("message", async (message) => {
          try {
            const data = JSON.parse(message);
            switch (data.event) {
              case "start":
                streamSid = data.start.streamSid;
                console.log(`[Twilio] Stream started with ID: ${streamSid}`);
                break;
              case "media":
                if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
                  const audioMessage = {
                    user_audio_chunk: Buffer.from(
                      data.media.payload,
                      "base64"
                    ).toString("base64"),
                  };
                  elevenLabsWs.send(JSON.stringify(audioMessage));
                }
                break;
              case "stop":
                if (elevenLabsWs) {
                  elevenLabsWs.close();
                }
                break;
              default:
                console.log(`[Twilio] Received unhandled event: ${data.event}`);
            }
          } catch (error) {
            console.error("[Twilio] Error processing message:", error);
          }
        });

        // Handle close event from Twilio
        connection.on("close", () => {
          if (elevenLabsWs) {
            elevenLabsWs.close();
          }
          console.log("[Twilio] Client disconnected");
        });

        // Handle errors from Twilio WebSocket
        connection.on("error", (error) => {
          console.error("[Twilio] WebSocket error:", error);
          if (elevenLabsWs) {
            elevenLabsWs.close();
          }
        });

      } catch (error) {
        console.error("[Server] Error initializing conversation:", error);
        if (elevenLabsWs) {
          elevenLabsWs.close();
        }
        connection.socket.close();
      }
    });
  });
}
// Code for unauthenticated outbound calls with your agent

import WebSocket from "ws";
import twilio from 'twilio';

export function registerOutboundRoutes(fastify) {
  // Check for required environment variables
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, ELEVENLABS_AGENT_ID } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER || !ELEVENLABS_AGENT_ID) {
    console.error("[ERROR] Missing required environment variables");
    throw new Error("Missing required environment variables for outbound calls");
  }

  // Initialize Twilio client
  const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

  // Route for outbound calls
  fastify.post("/outgoing-call", async (request, reply) => {
    const { firstMessage, number } = request.body;
    console.log("[CALL] Initiating outbound call to:", number);

    try {
      const call = await twilioClient.calls.create({
        from: TWILIO_PHONE_NUMBER,
        to: number,
        url: `https://${request.headers.host}/outgoing-call-twiml?firstMessage=${encodeURIComponent(firstMessage)}&number=${encodeURIComponent(number)}`
      });
      console.log("[CALL] Call initiated successfully:", call.sid);
      reply.send({ message: 'Call initiated', callSid: call.sid });
    } catch (error) {
      console.error("[ERROR] Failed to initiate call:", error.message);
      reply.status(500).send({ error: 'Failed to initiate call' });
    }
  });

  // TwiML for outgoing calls
  fastify.all("/outgoing-call-twiml", async (request, reply) => {
    console.log("[TWIML] Generating TwiML response");

    const firstMessage = request.query.firstMessage || "Hi, how are you?";
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Connect>
          <Stream url="wss://${request.headers.host}/outbound-media-stream" />
        </Connect>
      </Response>`;

    reply.type("text/xml").send(twimlResponse);
  });

  // WebSocket route for handling media streams
  fastify.register(async (fastifyInstance) => {
    fastifyInstance.get("/outbound-media-stream", { websocket: true }, (connection, req) => {
      console.log("[STREAM] Media stream connection established");
      let streamSid = null;

      // Connect to ElevenLabs WebSocket
      const elevenLabsWs = new WebSocket(
        `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${ELEVENLABS_AGENT_ID}`
      );

      elevenLabsWs.on("open", () => {
        console.log("[ELEVENLABS] Connection established");
      });

      // Handle messages from ElevenLabs
      elevenLabsWs.on("message", (data) => {
        try {
          const message = JSON.parse(data);
          handleElevenLabsMessage(message, connection);
        } catch (error) {
          console.error("[ERROR] ElevenLabs message processing failed:", error.message);
        }
      });

      // Function to handle messages from ElevenLabs
      const handleElevenLabsMessage = (message, connection) => {
        switch (message.type) {
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
        }
      };

      // Handle messages from Twilio
      connection.on("message", async (message) => {
        try {
          const data = JSON.parse(message);
          switch (data.event) {
            case "start":
              streamSid = data.start.streamSid;
              console.log("[STREAM] Started with ID:", streamSid);
              break;
            case "media":
              if (elevenLabsWs.readyState === WebSocket.OPEN) {
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
              console.log("[STREAM] Ended");
              elevenLabsWs.close();
              break;
          }
        } catch (error) {
          console.error("[ERROR] Stream processing failed:", error.message);
        }
      });

      // Handle connection closure
      connection.on("close", () => {
        console.log("[STREAM] Connection closed");
        if (elevenLabsWs.readyState === WebSocket.OPEN) {
          elevenLabsWs.close();
        }
      });
    });
  });
}
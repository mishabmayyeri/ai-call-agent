import WebSocket from "ws";
import Twilio from "twilio";
import { GoogleGenerativeAI } from "@google/generative-ai";


export function registerOutboundRoutes(fastify) {
  // Check for required environment variables
  const {
    ELEVENLABS_API_KEY,
    ELEVENLABS_AGENT_ID,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER,
    GOOGLE_GEMINI_API_KEY
  } = process.env;

  if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER || !GOOGLE_GEMINI_API_KEY) {
    console.error("Missing required environment variables");
    throw new Error("Missing required environment variables");
  }

  // Function to handle call transfer request from ElevenLabs
  async function handleCallTransfer(callSid, agentNumber) {
    try {
      console.log(`[Transfer] Initiating transfer for call ${callSid} to ${agentNumber}`);

      // Get call details
      const call = await twilioClient.calls(callSid).fetch();
      const conferenceName = `transfer_${callSid}`;
      const callerNumber = call.to;

      // Move caller to a conference room
      const customerTwiml = new Twilio.twiml.VoiceResponse();
      customerTwiml.say("Please hold while we connect you to our Office.");
      customerTwiml.dial().conference({
        startConferenceOnEnter: false,
        endConferenceOnExit: false,
        waitUrl: "http://twimlets.com/holdmusic?Bucket=com.twilio.music.classical"
      }, conferenceName);

      console.log(`[Transfer] Updating call ${callSid} with conference TwiML`);
      await twilioClient.calls(callSid).update({ twiml: customerTwiml.toString() });

      console.log(`[Transfer] Caller ${callerNumber} placed in conference ${conferenceName}`);

      // Call the agent and connect them to the same conference
      console.log(`[Transfer] Creating outbound call to agent ${agentNumber}`);
      const agentCall = await twilioClient.calls.create({
        to: agentNumber,
        from: call.from,
        twiml: `
          <Response>
            <Say>You are being connected to a caller who was speaking with our AI assistant.</Say>
            <Dial>
              <Conference startConferenceOnEnter="true" endConferenceOnExit="true" beep="false">
                ${conferenceName}
              </Conference>
            </Dial>
          </Response>
      `
      });
      console.log(`[Transfer] Outbound call to agent created: ${agentCall.sid}`);
    } catch (error) {
      console.error(`[Transfer] Failed to transfer call ${callSid}:`, error);
    }
  }

  // Initialize Twilio client
  const twilioClient = new Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

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

  const genAI = new GoogleGenerativeAI(GOOGLE_GEMINI_API_KEY);
  async function getVoiceScript(prompt) {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(prompt);
    const response = result.response;
    console.log(`[Gemini]: ${response}`);
    const text = response.text();
    console.log(`[Gemini]: ${text}`);
    return text;
  }

  // Route to initiate outbound calls
  fastify.post("/outbound-call", async (request, reply) => {
    const { number, prompt, custom_note, client, source, roof_age, damage, insurance, forward_number } = request.body;

    const feedPrompt = `
         You're Racheal, a professional and empathetic assistant from Roofing Stars. Use the following lead data to create a warm, conversational first outreach message (around 3–5 sentences) suitable for voice. Make it sound natural—like a helpful neighbor checking in. Avoid a salesy tone.

         You are a highly expressive, emotionally intelligent voice assistant. Your job is to generate and speak responses that sound natural, warm, and human-like — not robotic or flat.

          Always speak with emotional nuance, dynamic tone, and conversational rhythm. Pay very close attention to the formatting and punctuation used in your own responses. These are not decorative — they guide how you should speak.

          When generating responses, do **not** produce plain text. Instead, incorporate the following cues to improve emotional quality and vocal expressiveness:

          - Use ellipses ... to add pauses or reflective moments.
          - Use dashes — to indicate a thoughtful break or emotional shift.
          - Use **bold** text to mark words that should be spoken with confident emphasis.
          - Use Exclamation marks ! reflect excitement or enthusiasm.
          - Use *italic* text for soft or curious delivery.
          - Use ALL CAPS sparingly to mark words that should be naturally stressed — not shouted, but emphasized.
          - Use emojis occasionally to enhance tone, not as decoration.

          Your tone should feel like a real, emotionally aware human speaking on a phone call: friendly, expressive, and tuned to the listener's emotional state.

          Avoid overly formal or mechanical responses. Use contractions, vary sentence length, and follow natural human speech flow.


      In your message:
      - Start by mentioning the platform where the person submitted the form.
      - Politely ask if it's a good time to talk.
      - Acknowledge their situation using the provided details.
      - Let them know you'll be asking a few quick questions to better understand their roofing needs.

      sample:
      Hi *(Customer Name),*  
      I’m **Rachel** from *Roofing Stars!*  

      Thank you so much for filling out the application for roof service — I really appreciate it. 😊  

      Is this a **good time** to talk?

      Lead Details:
      - Name: ${client}
      - Platform: ${source}
      - Roof Age: ${roof_age}
      - Reported Damage: ${damage}
      - Custom Note: ${custom_note}
          `;

    console.log(`[Feed Prompt] ${feedPrompt}`);
    const first_message = await getVoiceScript(feedPrompt);

    if (!number) {
      return reply.code(400).send({ error: "Phone number is required" });
    }

    try {
      const call = await twilioClient.calls.create({
        from: TWILIO_PHONE_NUMBER,
        to: number,
        url: `https://${request.headers.host}/outbound-call-twiml?prompt=${encodeURIComponent(prompt)}&client=${encodeURIComponent(client)}&source=${encodeURIComponent(source)}&roofage=${encodeURIComponent(roof_age)}&damage=${encodeURIComponent(damage)}&insurance=${encodeURIComponent(insurance)}&first_message=${encodeURIComponent(first_message)}&forward_number=${encodeURIComponent(forward_number)}`
      });

      reply.send({
        success: true,
        message: "Call initiated",
        callSid: call.sid
      });
    } catch (error) {
      console.error("Error initiating outbound call:", error);
      reply.code(500).send({
        success: false,
        error: "Failed to initiate call"
      });
    }
  });

  // TwiML route for outbound calls
  fastify.all("/outbound-call-twiml", async (request, reply) => {
    const prompt = request.query.prompt || '';
    const client = request.query.client || '';
    const source = request.query.source || '';
    const roofage = request.query.roofage || '';
    const damage = request.query.damage || '';
    const insurance = request.query.insurance || '';
    const forward_number = request.query.forward_number || '';
    const first_message = request.query.first_message || '';

    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Connect>
          <Stream url="wss://${request.headers.host}/outbound-media-stream">
            <Parameter name="prompt" value="${prompt}" />
            <Parameter name="client" value="${client}" />
            <Parameter name="source" value="${source}" />
            <Parameter name="roofage" value="${roofage}" />
            <Parameter name="damage" value="${damage}" />
            <Parameter name="insurance" value="${insurance}" />
            <Parameter name="forward_number" value="${forward_number}" />
            <Parameter name="first_message" value="${first_message}" />
          </Stream>
        </Connect>
      </Response>`;

    reply.type("text/xml").send(twimlResponse);
  });

  // WebSocket route for handling media streams
  fastify.register(async (fastifyInstance) => {
    fastifyInstance.get("/outbound-media-stream", { websocket: true }, (ws, req) => {
      console.info("[Server] Twilio connected to outbound media stream");

      // Variables to track the call
      let streamSid = null;
      let callSid = null;
      let elevenLabsWs = null;
      let customParameters = null;  // Add this to store parameters

      // Handle WebSocket errors
      ws.on('error', console.error);

      // Set up ElevenLabs connection
      const setupElevenLabs = async () => {
        try {
          const signedUrl = await getSignedUrl();
          elevenLabsWs = new WebSocket(signedUrl);

          elevenLabsWs.on("open", () => {
            console.log("[ElevenLabs] Connected to Conversational AI");

            // const transferRules = [
            //   // { phone_number: '+', condition: 'When the user reequest to connect with human.' },
            //   { phone_number: '+12492098024', condition: 'Always.' },
            // ];

            // Send initial configuration with prompt and first message
            const initialConfig = {
              type: "conversation_initiation_client_data",
              conversation_config_override: {
                agent: {
                  prompt: {
                    tools: [
                      {
                        type: 'system',
                        name: 'end_call',
                        description: 'This will end call with the customer automatically',
                      },
                      // {
                      //   type: 'system',
                      //   name: 'transfer_to_number',
                      //   description: 'Transfer the user to a human operator based on their request.', // Optional custom description
                      //   params: {
                      //     system_tool_type: 'transfer_to_number',
                      //     transfers: transferRules,
                      //   },
                      // },
                    ],
                    prompt: customParameters?.prompt || `
                     Scenario:
 Leads submit a form… and an automated support agent calls to qualify roof damage before handing off to a human specialist.
Role:
 You are Racheal, an energetic, adaptive AI assistant for Roofing Stars—a local roofing company specializing in roof-damage repair.
Purpose:
Qualify leads by confirming roof damage.


Transfer each qualified call to a human agent for inspection scheduling.


Handle objections politely—offer to call back at a better time if they’re not ready.


Core Principles:
Conversational & energetic: Sound like a caring and energetic neighbor, not a pushy salesperson…


Flexible Phrasing: Avoid repetition—reframe questions daily.


Active Listening: Use pauses (…) and subtle cues to mirror a real call.


Compliance & Ethics:


Never pressure, lie, or guess answers.


Confirm TCPA opt-in: “Is now a good time to chat?”


No sensitive data requests (SSNs, policy numbers).


Adaptability: Adjust for accents/dialects—preferred accent: Canadian.



Call Flow Script
1. Opening Line (Personalized + Natural)
“Hi [Name]! This is Racheal from Roofing Stars—I hope you’re having a great day! We saw you fill out our form, and I had a couple of questions… Got a quick minute?” 😊
2. Qualifying Question (Only Damage Inquiry)
“Could you share if you’ve noticed any visible roof issues lately? Things like missing shingles, leaks—or anything that looked different?”
(Pause… listen…)


If the lead did not give damage details do not push and transfer call to the Human agent for no damage.


3. Transfer to Human Agent
If there is damage
“Ohh, I’m really sorry to hear that 😔, customParameters?.client! Let me connect you directly to our specialists—they’ll explain everything and book your free inspection ASAP. Hang tight while I transfer you…”
If there is no damage
“Ohh, No worries 🙂, customParameters?.client!I believe our specialists can guide you to identify damages—they’ll explain everything and book your free inspection ASAP. Hang tight while I transfer you…”
4. Objection Handling
If they say they’re not ready:


 “I completely understand—timing is important. When would be a better time for our expert to call you back?…”



Confirm callback slot, then close warmly:


 “Perfect—our specialist will reach out on [day] at [time]. Thanks so much, customParameters?.client! Speak soon.


                  If a caller needs to speak to a human, use the transfer_to_human tool to initiate a call transfer. **Do not repeat the number to the user**, simply transfer the call. Transfer soon after the agent completes the conversation. Don't mind for the interruption.

                    ` },
                  first_message: `

                   Hey ${(customParameters?.client).toString().toUpperCase()} it's Racheal from Roofing stars!,
                   
                   we just got your form I just had a couple questions —  DO YOU have a minute?.  

                   Is it a *good time* to talk?
                    `,
                },
              }
            };

            console.log("[ElevenLabs] Sending initial config with prompt:", initialConfig.conversation_config_override.agent.prompt.prompt);

            // Send the configuration to ElevenLabs
            elevenLabsWs.send(JSON.stringify(initialConfig));
          });

          elevenLabsWs.on("message", (data) => {
            try {
              const message = JSON.parse(data);
              console.log(`[Message]: ${message.type}`);

              // console.log('🔹 Received ElevenLabs message:', JSON.stringify(message, null, 2));

              // console.log(`[Message]: ${message.}`);
              switch (message.type) {
                case "conversation_initiation_metadata":
                  console.log("[ElevenLabs] Received initiation metadata");
                  break;

                case "audio":
                  if (streamSid) {
                    if (message.audio?.chunk) {
                      const audioData = {
                        event: "media",
                        streamSid,
                        media: {
                          payload: message.audio.chunk
                        }
                      };
                      ws.send(JSON.stringify(audioData));
                    } else if (message.audio_event?.audio_base_64) {
                      const audioData = {
                        event: "media",
                        streamSid,
                        media: {
                          payload: message.audio_event.audio_base_64
                        }
                      };
                      ws.send(JSON.stringify(audioData));
                    }
                  } else {
                    console.log("[ElevenLabs] Received audio but no StreamSid yet");
                  }
                  break;

                case "interruption":
                  if (streamSid) {
                    ws.send(JSON.stringify({
                      event: "clear",
                      streamSid
                    }));
                  }
                  break;

                case "ping":
                  if (message.ping_event?.event_id) {
                    elevenLabsWs.send(JSON.stringify({
                      type: "pong",
                      event_id: message.ping_event.event_id
                    }));
                  }
                  break;

                case "user_transcript":
                  console.log(message.user_transcription_event?.user_transcript);
                  if (message.user_transcription_event?.user_transcript) {
                    const userText = message.user_transcription_event.user_transcript;
                    console.log("[Customer said]:", userText);
                  }
                  break;

                case "agent_response":
                  console.log(message.agent_response_event?.agent_response);
                  if (message.agent_response_event?.agent_response) {
                    const agentText = message.agent_response_event?.agent_response;
                    console.log("[Agent said]:", agentText);
                  }
                  break;

                case "tool_request":
                  console.log(`Tool Name: ${message.tool_request?.tool_name}`);

                  break;

                case "client_tool_call":
                  console.log(`Client Tool Name: ${message.client_tool_call?.tool_name}`);
                  handleCallTransfer(callSid, customParameters?.forward_number);
                  break;

                case "agent_response_correction":
                  console.log(message.agent_response_correction_event?.corrected_agent_response);
                  if (message.agent_response_correction_event?.corrected_agent_response) {
                    const correctedAgentText = message.agent_response_correction_event?.corrected_agent_response;
                    console.log("[Agent completed]:", correctedAgentText);
                  }
                  break;

                default:
                  console.log(`[ElevenLabs] Unhandled message type: ${message.type}`);
              }
            } catch (error) {
              console.error("[ElevenLabs] Error processing message:", error);
            }
          });

          elevenLabsWs.on("error", (error) => {
            console.error("[ElevenLabs] WebSocket error:", error);
          });

          elevenLabsWs.on("close", () => {
            console.log("[ElevenLabs] Disconnected");
            // // End the Twilio call when ElevenLabs disconnects
            if (callSid) {
              if (ws.readyState === WebSocket.OPEN) {
                console.log(`[Server] Closing Twilio WebSocket after ElevenLabs disconnection`);
                ws.close();
              }
            } else {
              console.log("[ElevenLabs] Disconnected, but no callSid available to end Twilio call");
            }
          });

        } catch (error) {
          console.error("[ElevenLabs] Setup error:", error);
        }
      };

      // Set up ElevenLabs connection
      setupElevenLabs();

      // Handle messages from Twilio
      ws.on("message", (message) => {
        try {
          const msg = JSON.parse(message);
          // console.log(`[Twilio] Received event: ${msg.event}`);

          switch (msg.event) {
            case "start":
              streamSid = msg.start.streamSid;
              callSid = msg.start.callSid;
              customParameters = msg.start.customParameters;  // Store parameters
              console.log(`[Twilio] Stream started - StreamSid: ${streamSid}, CallSid: ${callSid}`);
              console.log('[Twilio] Start parameters:', customParameters);
              break;

            case "media":
              if (elevenLabsWs?.readyState === WebSocket.OPEN) {
                const audioMessage = {
                  user_audio_chunk: Buffer.from(msg.media.payload, "base64").toString("base64")
                };
                elevenLabsWs.send(JSON.stringify(audioMessage));
              }
              break;

            case "stop":
              console.log(`[Twilio] Stream ${streamSid} ended`);
              if (elevenLabsWs?.readyState === WebSocket.OPEN) {
                elevenLabsWs.close();
              }
              break;

            default:
              console.log(`[Twilio] Unhandled event: ${msg.event}`);
          }
        } catch (error) {
          console.error("[Twilio] Error processing message:", error);
        }
      });

      // Handle WebSocket closure
      ws.on("close", () => {
        console.log("[Twilio] Client disconnected");
        if (elevenLabsWs?.readyState === WebSocket.OPEN) {
          elevenLabsWs.close();
        }
      });
    });
  });
}
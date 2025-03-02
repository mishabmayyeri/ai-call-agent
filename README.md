# Connect Elevenlabs Conversation AI Agent to Twilio for Inbound and Outbound Calls

![CleanShot 2024-12-11 at 22 52 50 1](https://github.com/user-attachments/assets/97108c31-0679-44e5-a7a9-cc7e640dcbf1)

Watch the video tutorial here: https://youtu.be/_BxzbGh9uvk

## Overview

ElevenLabs recently released their [**Conversational AI Agent**](https://elevenlabs.io/conversational-ai), a tool for building interactive voice conversations. 

This repository provides the backend code to connect **Twilio** to your ElevenLabs Conversational AI Agent. With this setup, you can:

- Handle **inbound calls** from users.
- Initiate **outbound calls** programmatically.
- Pass **custom parameters** (e.g., user names, prompts) to personalize conversations.

This system is ideal for businesses looking to automate customer interactions, enhance call workflows, and create tailored user experiences at a low cost.

---

### Why So Many Scripts?

In the 'forTheLegends' folder I inclulde 7x different scripts:

![CleanShot 2024-12-11 at 14 24 28](https://github.com/user-attachments/assets/04b71136-3bbd-4020-aee4-e57dc0d861b3)

When I was coding out the final scripts that I demo in the above video ('inbound-calls.js' & 'outbound-calls.js'), I had to incrementally build out all of the scripts in the 'forTheLegends' folder.

They were difficult to build and get right, and so I thought they could hold some inherent value for other people who are also looking to build custom code solutions for their Elevenlabs agent.

I decided to include them in the repo as they might be good checkpoints/ starting points for other projects.

Here's what each script accomplishes:

#### Inbound Calls:
- **Unauthenticated inbound calls**: Basic inbound calls without custom parameter handling.
- **Authenticated inbound calls**: Enables secure inbound calls with authentication.
- **Inbound calls with custom parameters**: Pass specific user data (e.g., names or preferences) into the ElevenLabs agent for tailored conversations.

#### Outbound Calls:
- **Unauthenticated outbound calls**: Basic outbound calls without custom parameter handling.
- **Authenticated outbound calls**: Securely initiate outbound calls with authentication.
- **Outbound calls with custom parameters**: Pass specific user data into the agent for personalized interactions.
- **Boss Mode: Outbound calls with custom parameters from Make.com**: Use tools like Make.com to dynamically trigger calls and pass custom data (e.g., from a Google Sheet) into the ElevenLabs agent.

This breakdown provides all the flexibility you need to handle various call workflows while leveraging the full power of ElevenLabs' Conversational AI.

---

## Features:

- Handle **inbound and outbound calls** seamlessly.
- Authenticate requests for enhanced security.
- Pass custom parameters to personalize interactions.
- Integrate with **Make.com** to dynamically trigger calls with custom data.

---

## System Architecture

![CleanShot 2024-12-11 at 13 02 52](https://github.com/user-attachments/assets/30d38b95-a56b-419f-ad37-5e1fef0cab6a)

---

## Passing Through Custom Parameters

You need to use authenticated requests in order to pass custom variables into the agent.

Make sure to follow these settings to configure your AI agent (from within ElevenLabs) to:

1. Work with Twilio
2. Be able to use authenticated requests

Settings for Twilio: [https://elevenlabs.io/docs/conversational-ai/guides/conversational-ai-twilio](https://elevenlabs.io/docs/conversational-ai/guides/conversational-ai-twilio)

Settings for authenticated requests: [https://elevenlabs.io/docs/conversational-ai/customization/conversation-configuration](https://elevenlabs.io/docs/conversational-ai/customization/conversation-configuration)

**Note**: Make sure to also turn on "Enable Authentication."

![CleanShot 2024-12-11 at 14 01 09](https://github.com/user-attachments/assets/5deaca18-4aee-467d-8925-f67957cf6e08)

---

## Authenticated vs. Unauthenticated Workflow

- **Unauthenticated calls**: These calls do not allow for setting custom parameters, making them suitable for basic scenarios.
- **Authenticated calls**: These calls enable custom parameter handling, allowing you to create personalized experiences for your users.

![CleanShot 2024-12-11 at 13 21 50](https://github.com/user-attachments/assets/089bfaf2-5441-4ee0-8b11-a16a00b9383f)

---

## Passing in Custom Values from Make.com

We can pass in custom values from Make.com when triggering the call. For example, you can use a Google Sheet with customer details (e.g., name, company, custom prompts) to dynamically feed data into the AI agent.

### Workflow:

1. Use **Make.com** to trigger an outbound call with parameters.
2. Twilio uses **TwiML** to pass the variables into the Media Stream.
3. The WebSocket server accesses these variables and passes them to the ElevenLabs agent.

![CleanShot 2024-12-11 at 13 05 36](https://github.com/user-attachments/assets/382c95b5-4417-42e1-82ae-0ea8488d5878)

---

## How to Set Up

### Create `.env` File

```env
ELEVENLABS_AGENT_ID=your-elevenlabs-agent-id
ELEVENLABS_API_KEY=your-elevenlabs-api-key
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number
```

### Install Dependencies:
```bash
npm install
```

### Start the Server:
```bash
npm start
```

---

## Resources

Here are useful resources for setting up and understanding the project:

- [ElevenLabs Conversational AI Agent Documentation](https://elevenlabs.io/conversational-ai)
- [Settings for Twilio Integration](https://elevenlabs.io/docs/conversational-ai/guides/conversational-ai-twilio)
- [Settings for Authenticated Requests](https://elevenlabs.io/docs/conversational-ai/customization/conversation-configuration)
- Watch the tutorial video: https://youtu.be/_BxzbGh9uvk

---

Star ⭐ this repository if you find it helpful!

Want to donate? https://bartslodyczka.gumroad.com/l/potvn



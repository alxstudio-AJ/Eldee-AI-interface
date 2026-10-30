# Eldee AI Chatbot

Eldee is a lightweight AI study tutor built with Next.js and the Vercel AI SDK. It helps students ask questions about course material, explain difficult concepts step by step, and keep responses clear and encouraging.

## Features

- Conversational study assistant UI
- Streaming AI responses in real time
- Google Gemini model integration
- Tailored academic tutoring prompt for university students
- Simple Next.js app structure for easy extension

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- Vercel AI SDK
- Google Generative AI via `@ai-sdk/google`

## Project Structure

```text
app/
  api/chat/route.ts      API route for chat requests
  page.tsx              Home page
components/
  chat.tsx              Chat UI component
lib/
  ai/config.ts          AI model and prompt configuration
```

## Prerequisites

- Node.js 18+
- npm or pnpm
- A Google Gemini API key

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env.local` file in the project root and add your API key:

```bash
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key_here
```

3. Start the development server:

```bash
npm run dev
```

4. Open the app in your browser:

```text
http://localhost:3000
```

## Available Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Notes

- The app uses the `gemini-3.8-flash` model configured in `lib/ai/config.ts`.
- The system prompt is tuned for educational tutoring and explanation-heavy responses.
- If the API key is missing or invalid, the chat route returns a clear error message.

## License

This project is for educational and personal use unless otherwise specified.

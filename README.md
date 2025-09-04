<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# BurrMemeHub: AI Meme Generator

**Created by [BURROWBURR.FUN](https://burrowburr.fun) for the Starknet Community**

An AI-powered meme generator that creates crypto and Web3 memes using Google's Gemini AI. Generate images, enhance existing ones, and create viral memes with intelligent caption suggestions.

**Follow us:** [@burr_burrow](https://x.com/burr_burrow) | **Visit:** [burrowburr.fun](https://burrowburr.fun)

---

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/18sVznM1UcHgW6fhu2E_h4YA8GwmhPk3R

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local` file and set your Gemini API key:
   ```
   VITE_GEMINI_API_KEY=your-actual-api-key-here
   ```

3. Run the app:
   ```bash
   npm run dev
   ```

## Deploy to Vercel

1. Push your code to GitHub
2. Connect your GitHub repository to Vercel  
3. In Vercel dashboard, add environment variable:
   - **Name:** `VITE_GEMINI_API_KEY`
   - **Value:** Your actual Gemini API key
4. Deploy automatically

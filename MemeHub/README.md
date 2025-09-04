<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# MemeHub - AI-Powered Meme Generator

This contains everything you need to run your AI-powered meme generator app locally.

View your app in AI Studio: https://ai.studio/apps/drive/18sVznM1UcHgW6fhu2E_h4YA8GwmhPk3R

## Run Locally

**Prerequisites:** Node.js (v18+ recommended)

### Setup Instructions

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ereyli/Memehubai.git
   cd Memehubai
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   - Create a `.env.local` file in the root directory
   - Get your Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Add the following to `.env.local`:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser** and navigate to `http://localhost:5173` (or the port shown in terminal)

### Features

- 🎨 AI-powered meme generation with Gemini AI
- 🖼️ Image upload and manipulation
- ✨ Multiple meme styles and templates
- 🎯 Auto-caption generation
- 🔄 Image enhancement and combination tools
- 📱 Responsive design for all devices

---

**Last Updated**: $(date) - Current workspace code synchronized with GitHub repository

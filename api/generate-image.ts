import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt, style, size = "1024x1024" } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // Using OpenAI DALL-E 3 API
    const openaiResponse = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: `${prompt} in ${style} style`,
        n: 1,
        size: size,
        quality: "standard",
        response_format: "url"
      }),
    });

    if (!openaiResponse.ok) {
      const error = await openaiResponse.json();
      throw new Error(error.error?.message || "Failed to generate image");
    }

    const data = await openaiResponse.json();
    const imageUrl = data.data[0].url;

    res.status(200).json({ 
      success: true, 
      imageUrl: imageUrl,
      prompt: prompt,
      style: style
    });

  } catch (error) {
    console.error("Image generation error:", error);
    res.status(500).json({ 
      error: "Failed to generate image",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

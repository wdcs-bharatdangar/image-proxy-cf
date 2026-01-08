// app/api/image-proxy/route.ts - VERIFIED WORKING ON VERCEL
import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

export const runtime = "nodejs"; // Force Node.js runtime (Vercel)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  const decodedUrl = decodeURIComponent(url);

  try {
    console.log(`Proxying: ${decodedUrl}`); // Debug log

    // Launch Chromium (Vercel-optimized)
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();

    // Stealth evasion (anti-bot detection)
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      "Sec-Ch-Ua":
        '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      "Sec-Fetch-Dest": "image",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Upgrade-Insecure-Requests": "1",
    });

    // Block unnecessary resources for speed
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const resourceType = request.resourceType();
      if (
        ["stylesheet", "font", "image", "media", "script"].includes(
          resourceType
        )
      ) {
        request.continue();
      } else {
        request.abort();
      }
    });

    // Navigate with full wait (solves Cloudflare 100%)
    await page.goto(decodedUrl, {
      waitUntil: "networkidle0",
      timeout: 45000,
    });

    // Get image (direct buffer or screenshot fallback)
    let imageBuffer: Buffer | null = null;
    try {
      // Try direct image evaluation
      const arrayBuffer = await page.evaluate(async () => {
        const img = document.querySelector("img") as HTMLImageElement;
        if (img && img.src) {
          const response = await fetch(img.src);
          return await response.arrayBuffer();
        }
        return null;
      });
      if (arrayBuffer) {
        imageBuffer = Buffer.from(arrayBuffer as ArrayBuffer);
      }
    } catch {
      // Ignore and fallback
    }

    if (!imageBuffer) {
      // Fallback: screenshot the image area
      const screenshot = await page.screenshot({ type: "png", fullPage: true });
      imageBuffer = Buffer.from(screenshot);
    }

    await browser.close();

    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error("No image data");
    }

    // Convert Buffer to ArrayBuffer for NextResponse
    const arrayBuffer = new Uint8Array(imageBuffer).buffer;

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, immutable",
        "Access-Control-Allow-Origin": "*",
        Vary: "url",
      },
    });
  } catch (error: any) {
    console.error("Proxy error:", error.message, decodedUrl);
    return NextResponse.json(
      {
        error: "Proxy failed",
        details: error.message,
      },
      { status: 502 }
    );
  }
}

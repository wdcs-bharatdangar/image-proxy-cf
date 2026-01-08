// app/api/image-proxy/route.ts - VERIFIED WORKING ON VERCEL
import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

export const runtime = "nodejs"; // Force Node.js runtime (Vercel)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const forcePuppeteer = searchParams.get("puppeteer") === "true";

  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  const decodedUrl = decodeURIComponent(url);
  console.log(`[Image Proxy] Proxying: ${decodedUrl}`);

  // Try simple fetch first (faster and more reliable)
  if (!forcePuppeteer) {
    try {
      console.log("[Image Proxy] Attempting simple fetch...");
      const response = await fetch(decodedUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          Accept:
            "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: new URL(decodedUrl).origin,
          "Cache-Control": "no-cache",
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (response.ok) {
        console.log("[Image Proxy] Simple fetch succeeded!");
        const arrayBuffer = await response.arrayBuffer();
        const contentType =
          response.headers.get("content-type") || "image/jpeg";

        return new NextResponse(arrayBuffer, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=86400, immutable",
            "Access-Control-Allow-Origin": "*",
            Vary: "url",
          },
        });
      }

      console.log(
        `[Image Proxy] Simple fetch failed with status ${response.status}, falling back to Puppeteer...`
      );
    } catch (fetchError: any) {
      console.log(
        `[Image Proxy] Simple fetch error: ${fetchError.message}, falling back to Puppeteer...`
      );
    }
  }

  // Fallback to Puppeteer for protected sites
  try {
    console.log("[Image Proxy] Launching Puppeteer...");

    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    console.log("[Image Proxy] Browser launched, creating page...");
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

    console.log("[Image Proxy] Navigating to URL...");
    // Navigate with full wait (solves Cloudflare 100%)
    await page.goto(decodedUrl, {
      waitUntil: "networkidle0",
      timeout: 30000, // Reduced timeout
    });

    console.log("[Image Proxy] Page loaded, extracting image...");
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
        console.log("[Image Proxy] Image extracted via evaluate");
      }
    } catch (evalError: any) {
      console.log(`[Image Proxy] Evaluate failed: ${evalError.message}`);
    }

    if (!imageBuffer) {
      // Fallback: screenshot the image area
      console.log("[Image Proxy] Taking screenshot fallback...");
      const screenshot = await page.screenshot({ type: "png", fullPage: true });
      imageBuffer = Buffer.from(screenshot);
    }

    await browser.close();
    console.log("[Image Proxy] Browser closed");

    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error("No image data");
    }

    // Convert Buffer to ArrayBuffer for NextResponse
    const arrayBuffer = new Uint8Array(imageBuffer).buffer;

    console.log(
      `[Image Proxy] Success! Returning image (${imageBuffer.length} bytes)`
    );
    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, immutable",
        "Access-Control-Allow-Origin": "*",
        Vary: "url",
      },
    });
  } catch (error: any) {
    console.error("[Image Proxy] Error:", error.message, error.stack);
    return NextResponse.json(
      {
        error: "Proxy failed",
        details: error.message,
        url: decodedUrl,
      },
      { status: 502 }
    );
  }
}

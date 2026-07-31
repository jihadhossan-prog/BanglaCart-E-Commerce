import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEY } from "./aiConfig.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Firebase Admin if credentials available
  try {
    if (getApps().length === 0) {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        initializeApp({
          credential: cert(serviceAccount)
        });
      } else {
        initializeApp();
      }
    }
  } catch (e) {
    console.warn("Firebase Admin initialize warning:", e);
  }

  // API Routes
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.post("/api/chat/ai", async (req, res) => {
    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    // Default business values as fallback
    let businessDetails = {
      businessName: 'বাংলামার্ট',
      businessDescription: 'বাংলামার্ট হচ্ছে বাংলাদেশের একটি অন্যতম প্রিমিয়াম অনলাইন শপিং ই-কমার্স প্ল্যাটফর্ম। এখানে সেরা মানের এবং শতভাগ খাঁটি ও কোয়ালিটি পণ্য সাশ্রয়ী মূল্যে সরাসরি গ্রাহকদের কাছে পৌঁছে দেওয়া হয়।',
      phones: '+8801712-345678, +8801912-345678',
      email: 'support@banglamart.com',
      address: '১২/এ, সোনারগাঁও রোড, বাংলামোটর, ঢাকা-১০০০, বাংলাদেশ',
      deliveryInsideCharge: 60,
      deliveryInsideTime: '১ থেকে ২ কার্যদিবস',
      deliveryOutsideCharge: 120,
      deliveryOutsideTime: '৩ থেকে ৫ কার্যদিবস',
      orderProcess: '১. পছন্দের পণ্যটি বেছে নিয়ে "কার্টে যোগ করুন" অথবা "সরাসরি কিনুন" বাটনে ক্লিক করুন।\n২. চেকআউট পেজে গিয়ে আপনার সঠিক নাম, ফোন নম্বর, এবং সম্পূর্ণ ডেলিভারি ঠিকানা প্রদান করুন।\n৩. ডেলিভারি এলাকা নির্ধারণ করে "অর্ডার প্লেস করুন" বাটনে ক্লিক করে অর্ডারটি সম্পন্ন করুন।\n৪. আমাদের কাস্টমার রিপ্রেজেন্টেティブ আপনার ফোনে কল করে অর্ডারটি নিশ্চিত করবেন।',
      returnPolicy: '১. আমরা কোনো ত্রুটিপূর্ণ, ড্যামেজ বা ভুল পণ্য ডেলিভারি পেলে সম্পূর্ণ ফ্রিতে ৭ দিনের মধ্যে পরিবর্তন বা রিটার্ন করার সুযোগ দেই।\n২. রিটার্ন করার সময় পণ্যটি অক্ষত, অব্যবহৃত এবং মূল প্যাকেজিংসহ ফেরত দিতে হবে।\n৩. ডেলিভারি ম্যানের সামনে প্রোডাক্ট চেক করে রিসিভ করার জন্য বিশেষভাবে অনুরোধ করা হলো।'
    };

    // Attempt to load settings from firestore
    try {
      const db = getFirestore();
      const docRef = db.collection("system_settings").doc("ai_bot");
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        businessDetails = { ...businessDetails, ...docSnap.data() };
      }
    } catch (e) {
      console.warn("Could not load AI settings from Firestore, using default:", e);
    }

    const systemInstruction = `
You are an extremely polite and helpful AI Assistant for the online store "${businessDetails.businessName}". 
Always communicate in fluent, polite, and natural Bengali (বাংলা). Keep answers concise, accurate, and structured.

About Us / Business Description:
${businessDetails.businessDescription}

Contact Information:
- Phone Numbers: ${businessDetails.phones}
- Email: ${businessDetails.email}
- Shop Address: ${businessDetails.address}

Delivery Information:
- Inside Dhaka: Charge: ${businessDetails.deliveryInsideCharge} TK, Delivery Time: ${businessDetails.deliveryInsideTime}
- Outside Dhaka: Charge: ${businessDetails.deliveryOutsideCharge} TK, Delivery Time: ${businessDetails.deliveryOutsideTime}

How to Order (Ordering Process):
${businessDetails.orderProcess}

Return & Exchange Policy:
${businessDetails.returnPolicy}

If the user asks about products, help them politely. Answer any query about contact info, delivery times, return policies, or order steps using the information provided above. If you don't know the answer or if the query is unrelated, politely redirect them to contact human support or email.
`;

    // Retrieve API key
    let apiKey = GEMINI_API_KEY;
    if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE") {
      apiKey = process.env.GEMINI_API_KEY || "";
    }

    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key is not configured. Please add it to aiConfig.js or environmental variables." });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Prepare contents history
      const contents: any[] = [];
      if (Array.isArray(history)) {
        for (const turn of history) {
          if (turn.role && turn.parts) {
            contents.push({
              role: turn.role,
              parts: turn.parts.map((p: any) => ({ text: p.text || "" }))
            });
          }
        }
      }

      contents.push({
        role: "user",
        parts: [{ text: message }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        }
      });

      res.json({ reply: response.text || "আমি দুঃখিত, আমি আপনাকে সাহায্য করতে পারছি না।" });
    } catch (err: any) {
      console.error("Gemini API error:", err);
      res.status(500).json({ error: err.message || "An error occurred while generating response." });
    }
  });

  // Admin route fallback for cleaner URLs
  app.get("/admin", (_req, res, next) => {
    if (process.env.NODE_ENV === "production") {
      res.sendFile(path.join(process.cwd(), "dist", "admin.html"));
    } else {
      next();
    }
  });

  // Vite middleware in development, static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

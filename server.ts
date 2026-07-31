import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

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

  app.post("/api/admin/delete-user", async (req, res) => {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    try {
      if (getApps().length > 0) {
        await getAuth().deleteUser(userId);
      }
      return res.json({ success: true, message: "User deleted from Firebase Auth" });
    } catch (err: any) {
      console.warn("Delete user warning:", err?.message || err);
      return res.json({ success: false, warning: err?.message || "Firebase Admin Auth deletion bypassed" });
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

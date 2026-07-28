import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as admin from "firebase-admin";

const adminApp = admin as any;

if (!adminApp.apps || adminApp.apps.length === 0) {
  try {
    adminApp.initializeApp({
      projectId: "gen-lang-client-0746423772",
    });
  } catch (e) {
    console.error("Firebase admin init error:", e);
  }
}

const app = express();
const PORT = 3000;

app.use(express.json());

app.post("/api/admin/delete-user", async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    await adminApp.auth().deleteUser(userId);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting auth user:", error);
    if (error.code === 'auth/user-not-found') {
      return res.json({ success: true, warning: 'User not found in Auth' });
    }
    res.status(500).json({ error: error.message || 'Failed to delete auth user' });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

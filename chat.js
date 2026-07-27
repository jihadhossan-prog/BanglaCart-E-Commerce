// Real-Time Customer Live Support Chat Module
import { 
  db, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp 
} from "./firebase-config.js";
import { currentUser, currentUserProfile } from "./auth.js";
import { formatDate, escapeHtml, showToast } from "./core.js";

let chatUnsubscribe = null;

// Initialize or Load Chat Thread
export function renderChatView(containerEl) {
  if (!currentUser) {
    containerEl.innerHTML = `
      <div class="py-12 text-center">
        <div class="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-600">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
        </div>
        <h3 class="text-sm font-bold text-slate-800 mb-1">লাইভ চ্যাট সাপোর্ট</h3>
        <p class="text-xs text-slate-500 mb-4">আমাদের এডমিন প্রতিনিধির সাথে সরাসরি কথা বলতে লগইন করুন।</p>
        <a href="#profile" class="inline-flex items-center gap-2 bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs min-h-[44px]">
          সাইন ইন করুন
        </a>
      </div>
    `;
    return;
  }

  const chatId = currentUser.uid;

  containerEl.innerHTML = `
    <div class="chat-container">
      
      <!-- Chat Header -->
      <div class="p-3 bg-emerald-800 text-white flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></div>
          <div>
            <h3 class="text-xs font-bold leading-tight">আপনবাজার কাস্টমার কেয়ার</h3>
            <span class="text-[10px] text-emerald-200">এডমিন অনলাইনে আছেন</span>
          </div>
        </div>
      </div>

      <!-- Live Messages Stream -->
      <div class="chat-messages" id="chat-messages-body">
        <div class="text-center text-slate-400 text-xs py-4">বার্তা লোড হচ্ছে...</div>
      </div>

      <!-- Chat Input Form -->
      <form onsubmit="window.sendChatMessage(event)" class="p-2 border-t border-slate-200 bg-white flex items-center gap-2">
        <input 
          type="text" 
          id="chat-input-text" 
          placeholder="আপনার মেসেজ লিখুন..." 
          required 
          class="flex-1 bg-slate-100 border border-slate-200 rounded-full px-4 py-2 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white"
        >
        <button type="submit" class="w-10 h-10 rounded-full bg-emerald-700 text-white flex items-center justify-center shrink-0 min-h-[44px]">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
        </button>
      </form>

    </div>
  `;

  // Start Realtime Listener
  listenToChatMessages(chatId);
}

// Subscribe to Firestore Chat Messages
function listenToChatMessages(chatId) {
  if (!db) return;
  if (chatUnsubscribe) chatUnsubscribe();

  const messagesRef = collection(db, "chats", chatId, "messages");
  const q = query(messagesRef, orderBy("timestamp", "asc"));

  chatUnsubscribe = onSnapshot(q, (snapshot) => {
    const messagesBody = document.getElementById("chat-messages-body");
    if (!messagesBody) return;

    if (snapshot.empty) {
      messagesBody.innerHTML = `
        <div class="text-center py-8 text-slate-400 text-xs space-y-1">
          <p>স্বাগতম! আপনার যেকোনো প্রশ্ন বা অনুসন্ধানের জন্য এখানে মেসেজ দিন।</p>
        </div>
      `;
      return;
    }

    messagesBody.innerHTML = snapshot.docs.map(docSnap => {
      const msg = docSnap.data();
      const isMe = msg.senderRole === "customer";

      return `
        <div class="chat-bubble ${isMe ? 'chat-bubble-user' : 'chat-bubble-admin'}">
          <p>${escapeHtml(msg.text)}</p>
          <div class="chat-time">${formatDate(msg.timestamp)}</div>
        </div>
      `;
    }).join('');

    messagesBody.scrollTop = messagesBody.scrollHeight;
  }, (error) => {
    console.error("Chat subscription error:", error);
  });
}

// Send Chat Message
window.sendChatMessage = async function(event) {
  event.preventDefault();
  if (!currentUser || !db) return;

  const input = document.getElementById("chat-input-text");
  const text = input?.value.trim();
  if (!text) return;

  const chatId = currentUser.uid;
  input.value = "";

  try {
    // Ensure Chat parent document exists
    await setDoc(doc(db, "chats", chatId), {
      chatId,
      userId: currentUser.uid,
      userName: currentUserProfile?.fullName || currentUser.email,
      userEmail: currentUser.email,
      lastMessage: text,
      lastMessageTimestamp: new Date().toISOString(),
      unreadAdmin: 1,
      isUserOnline: true
    }, { merge: true });

    // Add message
    await addDoc(collection(db, "chats", chatId, "messages"), {
      chatId,
      senderId: currentUser.uid,
      senderRole: "customer",
      text,
      timestamp: new Date().toISOString(),
      isRead: false
    });

  } catch (err) {
    showToast("মেসেজ পাঠানো সম্ভব হয়নি", "error");
  }
};

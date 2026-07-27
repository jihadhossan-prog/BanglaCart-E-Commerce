import { db, auth } from './firebase-config.js';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { formatDate, showToast } from './core.js';

let unsubscribeMessages = null;

export function initChatSystem() {
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  
  if (chatForm && chatInput) {
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;
      
      chatInput.value = '';
      await sendChatMessage(text);
    });
  }
}

export function subscribeToUserChatMessages() {
  if (unsubscribeMessages) unsubscribeMessages();

  const userId = auth.currentUser?.uid || 'guest_chat';
  const chatId = `chat_${userId}`;

  const messagesContainer = document.getElementById('chat-messages');
  if (!messagesContainer) return;

  // Real-time listener for messages
  const q = query(
    collection(db, 'messages'),
    where('chatId', '==', chatId),
    orderBy('createdAt', 'asc')
  );

  unsubscribeMessages = onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      messagesContainer.innerHTML = `
        <div class="text-center py-8 text-xs text-slate-400">
          <p>BanglaCart সাপোর্টে স্বাগতম!</p>
          <p>আপনার যেকোনো প্রশ্ন বা হেল্পের জন্য সরাসরি লিখে পাঠান।</p>
        </div>
      `;
      return;
    }

    messagesContainer.innerHTML = snapshot.docs.map(docSnap => {
      const msg = docSnap.data();
      const isSentByMe = msg.senderId === userId;
      const timeStr = msg.createdAt ? formatDate(msg.createdAt) : 'এইমাত্র';

      return `
        <div class="flex flex-col ${isSentByMe ? 'items-end' : 'items-start'} my-1">
          <div class="chat-bubble ${isSentByMe ? 'sent' : 'received'}">
            <p>${msg.text}</p>
          </div>
          <span class="text-[10px] text-slate-400 mt-1 px-1">${timeStr}</span>
        </div>
      `;
    }).join('');

    // Auto Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }, (err) => {
    console.warn("Chat snapshot info:", err);
  });
}

export async function sendChatMessage(text) {
  const userId = auth.currentUser?.uid || 'guest_chat';
  const userName = auth.currentUser?.displayName || 'গ্রাহক';
  const chatId = `chat_${userId}`;

  try {
    // 1. Create/Update Chat Document
    await setDoc(doc(db, 'chats', chatId), {
      chatId: chatId,
      userId: userId,
      userName: userName,
      lastMessage: text,
      lastUpdated: new Date().toISOString(),
      unreadAdmin: true
    }, { merge: true });

    // 2. Add Message Document
    await addDoc(collection(db, 'messages'), {
      chatId: chatId,
      senderId: userId,
      receiverId: 'admin',
      text: text,
      createdAt: new Date().toISOString()
    });

  } catch (error) {
    console.warn("Chat message send error:", error);
    showToast('মেসেজ পাঠাতে সমস্যা হয়েছে', 'error');
  }
}

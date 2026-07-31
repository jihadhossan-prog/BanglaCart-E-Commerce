import { 
  db, 
  collection, 
  addDoc, 
  doc, 
  setDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  updateDoc,
  deleteDoc
} from './firebase-config.js';
import { formatDate, showToast, escapeHtml } from './core.js';
import { getCurrentUser, getUserProfile } from './auth.js';

let messageUnsubscribe = null;

export function cleanupLiveChat() {
  if (messageUnsubscribe) {
    messageUnsubscribe();
    messageUnsubscribe = null;
  }
}

export function initLiveChat(chatContainer, statusBadge) {
  const user = getCurrentUser();
  const profile = getUserProfile();

  if (!user) {
    chatContainer.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full p-6 text-center">
        <svg class="w-16 h-16 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
        <h3 class="font-semibold text-slate-800 text-base mb-1">লাইভ চ্যাট সার্ভিস</h3>
        <p class="text-xs text-slate-500 mb-4">অ্যাডমিনের সাথে সরাসরি কথা বলতে লগইন করুন</p>
        <button id="chat-login-trigger" class="px-5 py-2 bg-teal-700 text-white font-medium rounded-lg text-sm hover:bg-teal-800 transition">লগইন করুন</button>
      </div>
    `;

    document.getElementById('chat-login-trigger')?.addEventListener('click', () => {
      document.getElementById('auth-modal')?.classList.remove('hidden');
    });
    return;
  }

  const chatId = user.uid;

  // Listen to messages in real time
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'));

  if (messageUnsubscribe) messageUnsubscribe();

  messageUnsubscribe = onSnapshot(q, (snapshot) => {
    chatContainer.innerHTML = '';
    if (snapshot.empty) {
      chatContainer.innerHTML = `
        <div class="text-center py-10 text-xs text-slate-400">
          <p>বাংলামার্ট হেল্পডেস্কে স্বাগতম! আপনার যেকোনো প্রশ্ন এখানে লিখুন।</p>
        </div>
      `;
    } else {
      snapshot.forEach(docSnap => {
        const msg = docSnap.data();
        const isUser = msg.sender === 'user';
        const canDelete = isUser && (msg.senderId === user.uid || !msg.senderId);
        
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${isUser ? 'user' : 'admin'} mb-2 shadow-2xs relative group`;
        
        let contentHtml = escapeHtml(msg.text || '');
        if (msg.imageUrl) {
          contentHtml += `<img src="${escapeHtml(msg.imageUrl)}" class="mt-2 rounded-lg max-w-xs object-cover border border-slate-200" loading="lazy"/>`;
        }

        bubble.innerHTML = `
          <div>${contentHtml}</div>
          <div class="flex items-center justify-between text-[10px] opacity-70 mt-1 gap-2">
            ${canDelete ? `<button class="delete-msg-btn text-rose-200 hover:text-white underline cursor-pointer" data-id="${docSnap.id}">মুছুন</button>` : '<span></span>'}
            <span>${formatDate(msg.timestamp)}</span>
          </div>
        `;

        bubble.querySelector('.delete-msg-btn')?.addEventListener('click', async () => {
          if (confirm('এই মেসেজটি মুছে ফেলতে চান?')) {
            try {
              await deleteDoc(doc(db, 'chats', chatId, 'messages', docSnap.id));
              showToast('মেসেজ মুছে ফেলা হয়েছে', 'success');
            } catch (err) {
              console.error('Error deleting message:', err);
              showToast('মেসেজ মোছা যায়নি', 'error');
            }
          }
        });

        chatContainer.appendChild(bubble);
      });

      // Auto scroll to bottom
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }, (err) => {
    console.error('Chat error:', err);
  });
}

export async function sendChatMessage(text, imageUrl = '') {
  const user = getCurrentUser();
  if (!user) return;

  if (!text.trim() && !imageUrl) return;

  const chatId = user.uid;
  const messagesRef = collection(db, 'chats', chatId, 'messages');

  try {
    const profile = getUserProfile();
    // Ensure parent chat metadata document exists/is updated
    await setDoc(doc(db, 'chats', chatId), {
      userId: user.uid,
      userName: profile?.fullName || user.displayName || 'গ্রাহক',
      userEmail: user.email || '',
      userPhone: profile?.phone || '',
      lastMessage: text.trim() || 'ছবি সংযুক্ত করা হয়েছে',
      lastUpdated: new Date().toISOString(),
      unreadAdmin: true
    }, { merge: true });

    await addDoc(messagesRef, {
      sender: 'user',
      senderId: user.uid,
      text: text.trim(),
      imageUrl: imageUrl,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error sending message:', err);
    showToast('মেসেজ পাঠানো সম্ভব হয়নি', 'error');
  }
}

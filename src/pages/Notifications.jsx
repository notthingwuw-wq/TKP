import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export default function Notifications() {
  const { profile } = useAuth();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', profile.id),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    })();
  }, [profile]);

  const markRead = async (id) => {
    await updateDoc(doc(db, 'notifications', id), { read: true });
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, read: true } : x)));
  };

  return (
    <div className="space-y-2">
      {items.map((n) => (
        <div
          key={n.id}
          onClick={() => markRead(n.id)}
          className={`bg-white rounded-xl shadow p-3 ${n.read ? 'opacity-60' : ''}`}
        >
          <div className="font-medium">{n.title}</div>
          <div className="text-sm text-gray-600">{n.body}</div>
        </div>
      ))}
      {items.length === 0 && <div className="text-gray-500">Không có thông báo</div>}
    </div>
  );
}
// src/components/student/TeamSelectionModal.jsx
import { useState } from 'react';
import { doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import toast from 'react-hot-toast';

export default function TeamSelectionModal({ user, profile, onComplete }) {
  const [selecting, setSelecting] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);

  // classId từ profile — VD: "10A1"
  const classId = profile?.classId;
  if (!classId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
        <div className="bg-white rounded-2xl p-6 max-w-md">
          <p className="text-red-600 font-semibold">❌ Lỗi: Tài khoản chưa được gán lớp</p>
          <p className="text-sm text-gray-600 mt-2">Liên hệ admin để cập nhật classId.</p>
        </div>
      </div>
    );
  }

  // TeamId format: "{classId}-team{n}" — VD: "10A1-team1"
  const teams = [1, 2, 3, 4].map((n) => ({
    id: `${classId}-team${n}`,
    teamNumber: n,
    name: `Tổ ${n}`,
    color: [
      'bg-blue-500 hover:bg-blue-600',
      'bg-green-500 hover:bg-green-600',
      'bg-yellow-500 hover:bg-yellow-600',
      'bg-red-500 hover:bg-red-600'
    ][n - 1],
    icon: ['🔵', '🟢', '🟡', '🔴'][n - 1]
  }));

  const handleSelectTeam = async (teamId, teamName) => {
    if (selecting) return;
    setSelecting(true);
    setSelectedTeam(teamId);

    try {
      // 1. Cập nhật user
      await updateDoc(doc(db, 'users', user.uid), {
        teamId,
        status: 'active',
        activatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 2. Thêm user vào memberIds của tổ
      await updateDoc(doc(db, 'teams', teamId), {
        memberIds: arrayUnion(user.uid)
      });

      // 3. Cập nhật studentCount của lớp
      try {
        const classRef = doc(db, 'classes', classId);
        const classSnap = await (await import('firebase/firestore')).getDoc(classRef);
        if (classSnap.exists()) {
          const current = classSnap.data().studentCount || 0;
          await updateDoc(classRef, { studentCount: current + 1 });
        }
      } catch (e) {
        console.warn('Không update được studentCount:', e);
      }

      toast.success(`Đã chọn ${teamName}! 🎉`);

      setTimeout(() => onComplete(), 800);

    } catch (err) {
      console.error('Lỗi chọn tổ:', err);
      toast.error('Có lỗi xảy ra. Vui lòng thử lại!');
      setSelecting(false);
      setSelectedTeam(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full mx-4 animate-fade-in">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">👋</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Chào mừng {profile?.name || 'bạn'}!
          </h2>
          <p className="text-gray-600">Hãy chọn tổ của bạn để bắt đầu</p>
          <p className="text-xs text-gray-400 mt-1">Lớp: {classId}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {teams.map((team) => (
            <button
              key={team.id}
              onClick={() => handleSelectTeam(team.id, team.name)}
              disabled={selecting}
              className={`
                relative p-6 rounded-2xl text-white font-semibold text-lg
                transition-all duration-200 transform
                ${selecting
                  ? selectedTeam === team.id
                    ? 'scale-95 opacity-100'
                    : 'opacity-50 cursor-not-allowed'
                  : 'hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl'
                }
                ${team.color}
                disabled:cursor-not-allowed
              `}
            >
              <div className="text-4xl mb-2">{team.icon}</div>
              <div>{team.name}</div>
              {selecting && selectedTeam === team.id && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 rounded-2xl">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="text-center text-sm text-gray-500">
          <p>Bạn sẽ không thể thay đổi tổ sau khi chọn</p>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}
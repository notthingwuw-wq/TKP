// src/pages/gvcn/Placeholder.jsx
// Trang tạm — sẽ thay bằng code thật ở phần 2
import { Construction } from 'lucide-react';

export default function Placeholder({ name, description }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
      <div className="w-16 h-16 rounded-full bg-amber-50 mx-auto mb-4 flex items-center justify-center">
        <Construction className="w-8 h-8 text-amber-600" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">{name}</h2>
      <p className="text-sm text-gray-500 max-w-md mx-auto">
        {description || 'Trang này đang được xây dựng. Vui lòng quay lại sau.'}
      </p>
    </div>
  );
}
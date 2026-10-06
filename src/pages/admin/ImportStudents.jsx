import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import FileUploader from '../../components/admin/FileUploader';
import ImportPreview from '../../components/admin/ImportPreview';

export default function ImportStudents() {
  const { user } = useAuth();
  const [step, setStep] = useState(1); // 1: chọn lớp, 2: upload file, 3: preview, 4: done
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [file, setFile] = useState(null);
  const [students, setStudents] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [queueId, setQueueId] = useState(null);

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      const snap = await getDocs(collection(db, 'classes'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setClasses(list);
    } catch (err) {
      console.error('Error loading classes:', err);
      toast.error('Không thể tải danh sách lớp');
    }
  };

  const handleFileSelect = async (selectedFile) => {
    setFile(selectedFile);
    if (!selectedFile) {
      setStudents([]);
      setErrors([]);
      return;
    }

    try {
      // Parse Excel file
      const data = await selectedFile.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);

      // Map và validate
      const parsed = [];
      const validationErrors = [];

      rows.forEach((row, idx) => {
        const student = {
          name: row['Họ và tên'] || row['Họ tên'] || row['name'] || '',
          email: row['Email'] || row['email'] || '',
          password: String(row['Mật khẩu tạm'] || row['Mật khẩu'] || row['password'] || ''),
          teamNumber: parseInt(row['Tổ'] || row['Team'] || row['team'] || 0)
        };

        // Validate
        const errs = [];
        if (!student.name || student.name.trim() === '') {
          errs.push('Thiếu họ tên');
        }
        if (!student.email || !student.email.includes('@')) {
          errs.push('Email không hợp lệ');
        }
        if (!student.password || student.password.length < 6) {
          errs.push('Mật khẩu phải >= 6 ký tự');
        }
        if (!student.teamNumber || student.teamNumber < 1 || student.teamNumber > 4) {
          errs.push('Tổ phải từ 1-4');
        }

        if (errs.length > 0) {
          validationErrors.push({ row: idx, message: errs.join(', ') });
        }

        parsed.push(student);
      });

      setStudents(parsed);
      setErrors(validationErrors);
      setStep(3);

    } catch (err) {
      console.error('Error parsing file:', err);
      toast.error('Không thể đọc file Excel. Vui lòng kiểm tra định dạng!');
    }
  };

  const handleSubmit = async () => {
    if (errors.length > 0) {
      toast.error('Vui lòng sửa các lỗi trước khi tiếp tục!');
      return;
    }

    if (!selectedClass) {
      toast.error('Vui lòng chọn lớp!');
      return;
    }

    setLoading(true);
    try {
      // Tạo document trong import_queue
      const docRef = await addDoc(collection(db, 'import_queue'), {
        classId: selectedClass.id,
        className: selectedClass.name,
        students: students,
        status: 'pending',
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        processedAt: null,
        result: null
      });

      setQueueId(docRef.id);
      setStep(4);
      toast.success('Đã đưa vào hàng đợi!');

    } catch (err) {
      console.error('Error creating queue:', err);
      toast.error('Có lỗi xảy ra. Vui lòng thử lại!');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep(1);
    setSelectedClass(null);
    setFile(null);
    setStudents([]);
    setErrors([]);
    setQueueId(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Import học sinh</h2>
        <p className="text-gray-600">Tải lên file Excel để thêm học sinh hàng loạt</p>
      </div>

      {/* Steps */}
      {step < 4 && (
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${step >= s ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-600'}
              `}>
                {s}
              </div>
              {s < 3 && <div className={`w-16 h-1 ${step > s ? 'bg-brand-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      )}

      {/* Step 1: Chọn lớp */}
      {step === 1 && (
        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-4">
          <h3 className="font-semibold text-lg">Bước 1: Chọn lớp</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {classes.map((cls) => (
              <button
                key={cls.id}
                onClick={() => {
                  setSelectedClass(cls);
                  setStep(2);
                }}
                className="p-4 border-2 rounded-xl hover:border-brand-500 hover:bg-brand-50 transition-colors text-left"
              >
                <div className="font-medium text-gray-900">{cls.name}</div>
                <div className="text-sm text-gray-600">{cls.id}</div>
              </button>
            ))}
          </div>
          <a
            href="/samples/danh-sach-hoc-sinh-mau.xlsx"
            download
            className="inline-flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            📥 Tải file Excel mẫu
          </a>
        </div>
      )}

      {/* Step 2: Upload file */}
      {step === 2 && (
        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Bước 2: Tải file Excel</h3>
            <button onClick={() => setStep(1)} className="text-sm text-gray-600 hover:text-gray-900">
              ← Quay lại
            </button>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
            <strong>Lớp đã chọn:</strong> {selectedClass?.name}
          </div>
          <FileUploader onFileSelect={handleFileSelect} />
          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>Định dạng file Excel cần có các cột:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>"Họ và tên" hoặc "Họ tên"</li>
              <li>"Email"</li>
              <li>"Mật khẩu tạm" hoặc "Mật khẩu" (tối thiểu 6 ký tự)</li>
              <li>"Tổ" (số từ 1-4)</li>
            </ul>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 3 && (
        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Bước 3: Xem trước</h3>
            <button onClick={() => setStep(2)} className="text-sm text-gray-600 hover:text-gray-900">
              ← Quay lại
            </button>
          </div>
          <ImportPreview students={students} errors={errors} />
          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={loading || errors.length > 0}
              className="flex-1 bg-brand-600 text-white font-medium py-3 rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Đang xử lý...' : 'Đưa vào hàng đợi import'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Done - Hướng dẫn chạy script */}
      {step === 4 && (
        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-6">
          <div className="text-center">
            <div className="text-5xl mb-4">✅</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Đã đưa vào hàng đợi!</h3>
            <p className="text-gray-600">Queue ID: {queueId}</p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 space-y-4">
            <h4 className="font-semibold text-yellow-900">⚠️ Bước tiếp theo quan trọng:</h4>
            <p className="text-sm text-yellow-900">
              Do Firebase Spark không hỗ trợ Cloud Functions, bạn cần chạy script Node.js trên máy tính để tạo tài khoản Firebase Auth.
            </p>

            <div className="bg-white rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-gray-900">Chạy lệnh sau trong terminal:</p>
              <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm overflow-x-auto">
                cd thiduaclass<br />
                node scripts/import-students.js
              </div>
            </div>

            <div className="text-sm text-yellow-900 space-y-1">
              <p><strong>Lưu ý:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Cần có file <code className="bg-yellow-100 px-1 rounded">scripts/service-account.json</code></li>
                <li>Tải Service Account Key từ Firebase Console → Project Settings → Service accounts</li>
                <li>Script sẽ tự động xử lý tất cả queue đang pending</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex-1 bg-gray-100 text-gray-700 font-medium py-3 rounded-xl hover:bg-gray-200"
            >
              Import thêm
            </button>
            <a
              href="/admin/queue"
              className="flex-1 bg-brand-600 text-white font-medium py-3 rounded-xl hover:bg-brand-700 text-center"
            >
              Xem lịch sử import
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// src/pages/admin/ImportGVCN.jsx
// Import danh sách GVCN từ file Excel — tự động, không cần script
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, getDocs, doc, setDoc, updateDoc, getDoc,
  serverTimestamp, addDoc
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import * as XLSX from 'xlsx';
import {
  Upload, FileSpreadsheet, CheckCircle2, XCircle, Loader2,
  ArrowRight, Download, AlertCircle, UserCog, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ImportGVCN() {
  const { user: currentUser } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(1); // 1: upload, 2: preview, 3: done
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState({ success: [], failed: [] });

  // ===== Parse XLSX =====
  const handleFile = async (file) => {
    if (!file) return;

    if (!file.name.endsWith('.xlsx')) {
      toast.error('Chỉ chấp nhận file .xlsx');
      return;
    }

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws);

      if (raw.length === 0) {
        toast.error('File rỗng');
        return;
      }

      // Map cột
      const parsed = [];
      const validationErrors = [];

      raw.forEach((r, idx) => {
        const row = {
          stt: r['STT'] || (idx + 1),
          name: (r['Họ và tên'] || r['Họ tên'] || r['name'] || '').toString().trim(),
          email: (r['Email'] || r['email'] || '').toString().trim().toLowerCase(),
          password: (r['Mật khẩu tạm'] || r['Mật khẩu'] || r['password'] || '123456').toString(),
          classId: (r['Lớp'] || r['classId'] || r['Class'] || '').toString().trim().toUpperCase()
        };

        const errs = [];
        if (!row.name) errs.push('Thiếu họ tên');
        if (!row.email || !row.email.includes('@')) errs.push('Email không hợp lệ');
        if (!row.password || row.password.length < 6) errs.push('Mật khẩu < 6 ký tự');
        if (!row.classId || !/^1[0-2][ABC]\d{1,2}$/.test(row.classId)) {
          errs.push('Lớp sai định dạng (VD: 10A1)');
        }

        if (errs.length) validationErrors.push({ row: idx + 2, message: errs.join(', ') });

        parsed.push(row);
      });

      setRows(parsed);
      setErrors(validationErrors);
      setStep(2);
    } catch (err) {
      console.error(err);
      toast.error('Không đọc được file');
    }
  };

  // ===== Import =====
  const handleImport = async () => {
    if (errors.length > 0) {
      toast.error('Còn lỗi trong file — sửa trước khi import');
      return;
    }

    setImporting(true);
    setProgress({ current: 0, total: rows.length });

    const success = [];
    const failed = [];

    // Load classes để validate
    const classesSnap = await getDocs(collection(db, 'classes'));
    const classMap = new Map();
    classesSnap.forEach(d => classMap.set(d.id, d.data()));

    const { createAuthUser, signInExistingUser } = await import('../../lib/authRest');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      setProgress({ current: i + 1, total: rows.length });

      try {
        // Check lớp tồn tại
        if (!classMap.has(row.classId)) {
          failed.push({ ...row, error: `Lớp ${row.classId} chưa tồn tại trong hệ thống` });
          continue;
        }

        let authUser;
        try {
          authUser = await createAuthUser(row.email, row.password);
        } catch (err) {
          if (err.message.includes('đã tồn tại')) {
            // Thử sign in để recover user cũ
            const existing = await signInExistingUser(row.email, row.password);
            if (!existing) {
              failed.push({ ...row, error: 'Email đã tồn tại với mật khẩu khác' });
              continue;
            }
            authUser = existing;
          } else {
            failed.push({ ...row, error: err.message });
            continue;
          }
        }

        // Ghi Firestore users/{uid}
        await setDoc(doc(db, 'users', authUser.localId), {
          name: row.name,
          email: row.email,
          role: 'GVCN',
          classId: row.classId,
          teamId: null,
          status: 'active',
          falseReportCount: 0,
          settings: { notifications: true },
          createdAt: serverTimestamp(),
          createdBy: currentUser.uid
        });

        // Update class.teacherId
        await updateDoc(doc(db, 'classes', row.classId), {
          teacherId: authUser.localId,
          teacherName: row.name
        });

        success.push({ ...row, uid: authUser.localId });

        // Delay nhỏ tránh rate limit Firebase Auth
        await new Promise(r => setTimeout(r, 150));

      } catch (err) {
        console.error(`[${row.email}]`, err);
        failed.push({ ...row, error: err.message });
      }
    }

    // Audit log
    await addDoc(collection(db, 'audit_logs'), {
      actorId: currentUser.uid,
      action: 'import_gvcn',
      targetType: 'batch',
      after: {
        total: rows.length,
        success: success.length,
        failed: failed.length
      },
      createdAt: serverTimestamp()
    });

    setResults({ success, failed });
    setImporting(false);
    setStep(3);
    toast.success(`Import xong: ${success.length}/${rows.length} thành công`);
  };

  const reset = () => {
    setStep(1);
    setRows([]);
    setErrors([]);
    setResults({ success: [], failed: [] });
    setProgress({ current: 0, total: 0 });
  };

  // ===== RENDER =====
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Import danh sách GVCN</h1>
        <p className="text-gray-600 text-sm mt-1">
          Tải file Excel chứa danh sách GVCN để tạo hàng loạt tài khoản
        </p>
      </div>

      {/* Steps */}
      {step < 3 && (
        <div className="flex items-center justify-center gap-2">
          {[1, 2].map(s => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                step >= s ? 'bg-brand-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {s}
              </div>
              {s < 2 && <div className={`w-16 h-1 ${step > s ? 'bg-brand-500' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      )}

      {/* ===== STEP 1: Upload ===== */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Bước 1: Tải file Excel</h3>
          </div>

          <label className="block">
            <input
              type="file"
              accept=".xlsx"
              onChange={e => handleFile(e.target.files?.[0])}
              className="hidden"
              id="gvcn-file-input"
            />
            <div
              onClick={() => document.getElementById('gvcn-file-input').click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-colors"
            >
              <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
              <div className="font-medium text-gray-700">Nhấn để chọn file</div>
              <div className="text-xs text-gray-500 mt-1">Chỉ chấp nhận .xlsx</div>
            </div>
          </label>

          {/* File format guide */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-900 leading-relaxed">
                <strong>Định dạng file Excel yêu cầu:</strong>
                <div className="mt-2 font-mono bg-white rounded p-2 overflow-x-auto text-[11px]">
                  <div className="font-bold border-b border-gray-300 pb-1 mb-1">
                    STT | Họ và tên | Email | Mật khẩu tạm | Lớp
                  </div>
                  <div>1 | Nguyễn Văn A | gvcn10a1@truong.edu.vn | 123456 | 10A1</div>
                  <div>2 | Trần Thị B | gvcn10a2@truong.edu.vn | 123456 | 10A2</div>
                </div>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>Mã lớp phải tồn tại trong hệ thống (đã tạo ở tab Quản lý lớp)</li>
                  <li>Email phải unique, chưa tồn tại trong Firebase Auth</li>
                  <li>Mật khẩu tối thiểu 6 ký tự</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Sample download */}
          <button
            onClick={() => {
              const a = document.createElement('a');
              a.href = '/samples/danh-sach-gvcn-mau.xlsx';
              a.download = 'danh-sach-gvcn-mau.xlsx';
              a.click();
            }}
            className="inline-flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            <Download className="w-4 h-4" />
            Tải file Excel mẫu
          </button>
        </div>
      )}

      {/* ===== STEP 2: Preview ===== */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Bước 2: Xem trước</h3>
            <button onClick={reset} className="text-sm text-gray-600 hover:text-gray-900">
              ← Quay lại
            </button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-xs text-blue-700">Tổng số dòng</div>
              <div className="text-2xl font-bold text-blue-900">{rows.length}</div>
            </div>
            <div className={`border rounded-lg p-3 ${
              errors.length > 0
                ? 'bg-red-50 border-red-200'
                : 'bg-green-50 border-green-200'
            }`}>
              <div className={`text-xs ${errors.length > 0 ? 'text-red-700' : 'text-green-700'}`}>
                Lỗi
              </div>
              <div className={`text-2xl font-bold ${
                errors.length > 0 ? 'text-red-900' : 'text-green-900'
              }`}>
                {errors.length}
              </div>
            </div>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="font-semibold text-red-900 text-sm mb-2">
                Danh sách lỗi cần sửa:
              </div>
              <div className="space-y-1 text-xs text-red-800 max-h-40 overflow-y-auto">
                {errors.map((e, i) => (
                  <div key={i}>
                    <strong>Dòng {e.row}:</strong> {e.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-96">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">STT</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Họ tên</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Lớp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r, i) => {
                    const hasError = errors.some(e => e.row === i + 2);
                    return (
                      <tr key={i} className={hasError ? 'bg-red-50' : ''}>
                        <td className="px-3 py-2 text-sm">{r.stt}</td>
                        <td className="px-3 py-2 text-sm font-medium">{r.name}</td>
                        <td className="px-3 py-2 text-sm text-gray-600">{r.email}</td>
                        <td className="px-3 py-2 text-sm font-mono">{r.classId}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Progress */}
          {importing && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-blue-900">
                    Đang import: {progress.current}/{progress.total}
                  </div>
                  <div className="mt-2 h-2 bg-blue-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={reset}
              disabled={importing}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              onClick={handleImport}
              disabled={importing || errors.length > 0}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-semibold py-2.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang import...
                </>
              ) : (
                <>
                  <UserCog className="w-4 h-4" />
                  Bắt đầu import {rows.length} GVCN
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ===== STEP 3: Result ===== */}
      {step === 3 && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <CheckCircle2 className="w-8 h-8 text-green-600 mb-2" />
              <div className="text-3xl font-bold text-green-900">{results.success.length}</div>
              <div className="text-xs text-green-700 mt-1">Tạo thành công</div>
            </div>
            <div className={`border rounded-xl p-5 ${
              results.failed.length > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
            }`}>
              <XCircle className={`w-8 h-8 mb-2 ${
                results.failed.length > 0 ? 'text-red-600' : 'text-gray-400'
              }`} />
              <div className={`text-3xl font-bold ${
                results.failed.length > 0 ? 'text-red-900' : 'text-gray-900'
              }`}>
                {results.failed.length}
              </div>
              <div className={`text-xs mt-1 ${
                results.failed.length > 0 ? 'text-red-700' : 'text-gray-500'
              }`}>
                Thất bại
              </div>
            </div>
          </div>

          {/* Failed details */}
          {results.failed.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b bg-red-50 border-red-200">
                <h3 className="font-semibold text-red-900 text-sm">Chi tiết lỗi</h3>
              </div>
              <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                {results.failed.map((f, i) => (
                  <div key={i} className="px-4 py-3">
                    <div className="font-medium text-sm text-gray-900">{f.name}</div>
                    <div className="text-xs text-gray-500">{f.email}</div>
                    <div className="text-xs text-red-600 mt-1">{f.error}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Success list */}
          {results.success.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b bg-green-50 border-green-200">
                <h3 className="font-semibold text-green-900 text-sm">
                  GVCN đã tạo ({results.success.length})
                </h3>
              </div>
              <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                {results.success.map((s, i) => (
                  <div key={i} className="px-4 py-3 flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {s.name}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {s.email} · Lớp {s.classId}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl"
            >
              <RefreshCw className="w-4 h-4 inline mr-2" />
              Import tiếp
            </button>
            <button
              onClick={() => nav('/admin/users?role=GVCN')}
              className="flex-1 px-4 py-3 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-xl"
            >
              Xem danh sách GVCN
              <ArrowRight className="w-4 h-4 inline ml-2" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export default function ImportPreview({ students, errors = [] }) {
  if (!students || students.length === 0) {
    return null;
  }

  const preview = students.slice(0, 5);
  const hasMore = students.length > 5;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">
            Preview {preview.length} dòng đầu
          </h3>
          <p className="text-sm text-gray-600">
            Tổng cộng: {students.length} học sinh
          </p>
        </div>
        {errors.length > 0 && (
          <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm font-medium">
            ⚠️ {errors.length} lỗi
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto border rounded-xl">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                STT
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Họ và tên
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Mật khẩu
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tổ
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Trạng thái
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {preview.map((student, idx) => {
              const error = errors.find(e => e.row === idx);
              const isError = !!error;

              return (
                <tr key={idx} className={isError ? 'bg-red-50' : ''}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {idx + 1}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {student.name || <span className="text-red-500">Thiếu</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {student.email || <span className="text-red-500">Thiếu</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">
                    {student.password ? '••••••' : <span className="text-red-500">Thiếu</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {student.teamNumber ? `Tổ ${student.teamNumber}` : <span className="text-red-500">Thiếu</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {isError ? (
                      <span className="text-red-600 font-medium" title={error.message}>
                        ❌ Lỗi
                      </span>
                    ) : (
                      <span className="text-green-600">✅ OK</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <p className="text-sm text-gray-500 text-center">
          ... và {students.length - 5} học sinh khác
        </p>
      )}

      {/* Error List */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h4 className="font-semibold text-red-900 mb-2">Chi tiết lỗi:</h4>
          <ul className="space-y-1 text-sm text-red-700">
            {errors.map((err, idx) => (
              <li key={idx}>
                • Dòng {err.row + 1}: {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

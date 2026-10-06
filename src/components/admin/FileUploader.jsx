import { useRef, useState } from 'react';

export default function FileUploader({ onFileSelect, accept = ".xlsx,.xls" }) {
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState(null);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file) => {
    // Kiểm tra extension
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(ext)) {
      alert('Chỉ chấp nhận file Excel (.xlsx, .xls)');
      return;
    }

    // Kiểm tra size (tối đa 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File quá lớn! Tối đa 10MB');
      return;
    }

    setFileName(file.name);
    onFileSelect(file);
  };

  const handleButtonClick = () => {
    inputRef.current?.click();
  };

  const handleRemove = () => {
    setFileName(null);
    onFileSelect(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />

      {!fileName ? (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={handleButtonClick}
          className={`
            relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
            transition-all duration-200
            ${dragActive
              ? 'border-brand-500 bg-brand-50'
              : 'border-gray-300 bg-gray-50 hover:border-brand-400 hover:bg-brand-25'
            }
          `}
        >
          <div className="space-y-4">
            <div className="text-5xl">📁</div>
            <div>
              <p className="text-lg font-medium text-gray-900 mb-1">
                Kéo thả file Excel vào đây
              </p>
              <p className="text-sm text-gray-600">
                hoặc click để chọn file
              </p>
            </div>
            <div className="text-xs text-gray-500">
              Định dạng: .xlsx, .xls | Tối đa: 10MB
            </div>
          </div>
        </div>
      ) : (
        <div className="border-2 border-brand-500 bg-brand-50 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl">📄</div>
              <div>
                <div className="font-medium text-gray-900">{fileName}</div>
                <div className="text-sm text-gray-600">File đã chọn</div>
              </div>
            </div>
            <button
              onClick={handleRemove}
              className="text-red-600 hover:text-red-700 font-medium text-sm"
            >
              Xóa
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

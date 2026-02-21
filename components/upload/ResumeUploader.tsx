'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useInterviewStore } from '@/stores/interviewStore';

const ACCEPTED_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/markdown': ['.md'],
  'text/plain': ['.txt'],
};

export function ResumeUploader() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resumeFileName = useInterviewStore((s) => s.resumeFileName);
  const resumeText = useInterviewStore((s) => s.resumeText);
  const setResumeText = useInterviewStore((s) => s.setResumeText);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setError(null);
      setIsUploading(true);

      try {
        const formData = new FormData();
        formData.append('resume', file);

        const res = await fetch('/api/parse-resume', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || '이력서 파싱에 실패했습니다.');
        }

        setResumeText(data.text, data.fileName);
      } catch (err) {
        setError(err instanceof Error ? err.message : '이력서 업로드에 실패했습니다.');
      } finally {
        setIsUploading(false);
      }
    },
    [setResumeText]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024, // 5MB
    disabled: isUploading,
    onDropRejected: (rejections) => {
      const code = rejections[0]?.errors[0]?.code;
      if (code === 'file-too-large') {
        setError('파일 크기는 5MB 이하만 가능합니다.');
      } else if (code === 'file-invalid-type') {
        setError('PDF, DOCX, MD, TXT 파일만 업로드 가능합니다.');
      }
    },
  });

  const handleRemove = () => {
    setResumeText('', '');
    useInterviewStore.setState({
      resumeText: null,
      resumeFileName: null,
    });
    setError(null);
  };

  if (resumeText && resumeFileName) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-green-600" />
          <div>
            <p className="text-sm font-medium text-green-800">{resumeFileName}</p>
            <p className="text-xs text-green-600">
              {resumeText.length.toLocaleString()}자 추출 완료
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleRemove}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50'
        } ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
      >
        <input {...getInputProps()} />
        {isUploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="h-8 w-8 text-muted-foreground" />
        )}
        <p className="mt-3 text-sm font-medium">
          {isDragActive ? '여기에 파일을 놓으세요' : '이력서 파일을 드래그하거나 클릭하여 업로드'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          PDF, DOCX, MD, TXT (최대 5MB)
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

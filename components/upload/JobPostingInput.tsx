'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Loader2, Link as LinkIcon, FileText, Image, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useInterviewStore } from '@/stores/interviewStore';

export function JobPostingInput() {
  const [tab, setTab] = useState<string>('url');
  const [url, setUrl] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const jobPostingText = useInterviewStore((s) => s.jobPostingText);
  const jobCompanyName = useInterviewStore((s) => s.jobCompanyName);
  const jobPosition = useInterviewStore((s) => s.jobPosition);
  const setJobPostingText = useInterviewStore((s) => s.setJobPostingText);

  const handleFetchUrl = async () => {
    if (!url.trim()) {
      setError('원티드 URL을 입력해주세요.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/fetch-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '채용공고를 가져오는데 실패했습니다.');
      }

      setJobPostingText(data.text, data.companyName, data.position);
    } catch (err) {
      setError(err instanceof Error ? err.message : '채용공고 로딩에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasteSubmit = () => {
    const trimmed = pasteText.trim();
    if (!trimmed) {
      setError('채용공고 내용을 입력해주세요.');
      return;
    }
    if (trimmed.length < 50) {
      setError('채용공고 내용이 너무 짧습니다. 최소 50자 이상 입력해주세요.');
      return;
    }
    setError(null);
    setJobPostingText(trimmed);
  };

  const onDropImage = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setError(null);
      setIsLoading(true);

      try {
        const formData = new FormData();
        formData.append('image', file);

        const res = await fetch('/api/ocr', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || '이미지 텍스트 추출에 실패했습니다.');
        }

        if (data.text.trim().length < 50) {
          throw new Error('추출된 텍스트가 너무 짧습니다. 더 선명한 스크린샷을 사용해주세요.');
        }

        setJobPostingText(data.text.trim());
      } catch (err) {
        setError(err instanceof Error ? err.message : '이미지 처리에 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    },
    [setJobPostingText]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropImage,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    disabled: isLoading,
    onDropRejected: (rejections) => {
      const code = rejections[0]?.errors[0]?.code;
      if (code === 'file-too-large') {
        setError('이미지 크기는 10MB 이하만 가능합니다.');
      } else if (code === 'file-invalid-type') {
        setError('PNG, JPG, WebP 이미지만 지원합니다.');
      }
    },
  });

  const handleReset = () => {
    useInterviewStore.setState({
      jobPostingText: null,
      jobCompanyName: null,
      jobPosition: null,
    });
    setUrl('');
    setPasteText('');
    setError(null);
  };

  if (jobPostingText) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-center gap-3">
          <Check className="h-5 w-5 text-green-600" />
          <div>
            <p className="text-sm font-medium text-green-800">
              {jobCompanyName && jobPosition
                ? `${jobCompanyName} - ${jobPosition}`
                : '채용공고 입력 완료'}
            </p>
            <p className="text-xs text-green-600">
              {jobPostingText.length.toLocaleString()}자
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleReset}>
          변경
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="url" className="flex-1 gap-1.5">
            <LinkIcon className="h-3.5 w-3.5" />
            원티드 URL
          </TabsTrigger>
          <TabsTrigger value="paste" className="flex-1 gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            직접 입력
          </TabsTrigger>
          <TabsTrigger value="screenshot" className="flex-1 gap-1.5">
            <Image className="h-3.5 w-3.5" />
            스크린샷
          </TabsTrigger>
        </TabsList>

        <TabsContent value="url" className="space-y-3">
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://www.wanted.co.kr/wd/12345"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isLoading}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleFetchUrl();
              }}
            />
            <Button onClick={handleFetchUrl} disabled={isLoading || !url.trim()}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                '불러오기'
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            원티드(wanted.co.kr) 채용공고 URL을 입력하세요
          </p>
        </TabsContent>

        <TabsContent value="paste" className="space-y-3">
          <textarea
            placeholder="채용공고 내용을 붙여넣으세요 (자격요건, 우대사항, 주요업무 등)"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={6}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {pasteText.length > 0 ? `${pasteText.length}자` : '최소 50자 이상'}
            </p>
            <Button
              onClick={handlePasteSubmit}
              disabled={!pasteText.trim()}
              size="sm"
            >
              입력 완료
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="screenshot" className="space-y-3">
          <div
            {...getRootProps()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50'
            } ${isLoading ? 'pointer-events-none opacity-50' : ''}`}
          >
            <input {...getInputProps()} />
            {isLoading ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <Image className="h-8 w-8 text-muted-foreground" />
            )}
            <p className="mt-3 text-sm font-medium">
              {isLoading
                ? 'OCR 텍스트 추출 중...'
                : isDragActive
                  ? '여기에 이미지를 놓으세요'
                  : '채용공고 스크린샷을 드래그하거나 클릭하여 업로드'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              PNG, JPG, WebP (최대 10MB)
            </p>
          </div>
        </TabsContent>
      </Tabs>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

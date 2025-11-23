import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Textarea } from "./ui/textarea";
import { PlusCircle, Trash2, ListChecks, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner@2.0.3";
import { Category } from "./CategorySelection";
import type { Question } from "./QuizPage";

export interface ReportedQuestion {
  id: number;
  questionId?: number;
  questionText: string;
  categoryName?: string;
  categorySlug?: string;
  options: string[];
  correctAnswerIndex: number | null;
  reason: string;
  reporterId?: string;
  reporterUsername?: string;
  reportedAt?: string;
  status?: string;
}

interface AdminPanelProps {
  onAddQuestion: (question: Omit<Question, "id">) => void;
  questions: Question[];
  onDeleteQuestion: (id: number) => void;
  onSubmitAll: (questions: Question[]) => Promise<void>;
  fetchReportedQuestions: () => Promise<ReportedQuestion[]>;
}

type ReportEditorState = {
  reportId: number;
  question: string;
  category: string;
  options: string[];
  correctAnswer: string;
  reason: string;
  reporterInfo: string;
  reportedAtLabel: string | null;
  original: ReportedQuestion;
};

export function AdminPanel({
  onAddQuestion,
  questions,
  onDeleteQuestion,
  onSubmitAll,
  fetchReportedQuestions,
}: AdminPanelProps) {
  const [questionText, setQuestionText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState<string>('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportedQuestions, setReportedQuestions] = useState<ReportedQuestion[]>([]);
  const [isFetchingReports, setIsFetchingReports] = useState(false);
  const [fetchReportsError, setFetchReportsError] = useState<string | null>(null);
  const [isReportEditorOpen, setIsReportEditorOpen] = useState(false);
  const [reportEditorState, setReportEditorState] = useState<ReportEditorState | null>(null);
  const reportedCount = reportedQuestions.length;
  const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

  const categories: Category[] = [
    'Coğrafya',
    'Teknoloji',
    'Tarih',
    'Spor',
    'Genel Kültür',
    'Sanat',
    'Müzik',
    'Bilim'
  ];

  type ReportEditorState = {
    reportId: number;
    question: string;
    category: string;
    options: string[];
    correctAnswer: string;
    reason: string;
    reporterInfo: string;
    reportedAtLabel: string | null;
    original: ReportedQuestion;
  };

  const loadReportedQuestions = useCallback(async () => {
    setIsFetchingReports(true);
    setFetchReportsError(null);

    try {
      const reports = await fetchReportedQuestions();
      setReportedQuestions(reports);
    } catch (error) {
      console.error('Raporlanan sorular alınamadı', error);
      const message = error instanceof Error ? error.message : 'Raporlanan sorular alınamadı.';
      setFetchReportsError(message);
    } finally {
      setIsFetchingReports(false);
    }
  }, [fetchReportedQuestions]);

  useEffect(() => {
    loadReportedQuestions().catch(() => {
      // İlk yüklemede hata zaten setFetchReportsError ile işlendi.
    });
  }, [loadReportedQuestions]);

  const formatReportedDate = (value?: string) => {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString('tr-TR');
    }

    return value;
  };

  const normalizeCategoryValue = (value: string) =>
    value
      .toLocaleLowerCase('tr')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/gi, '');

  const resolveCategoryFromReport = (report: ReportedQuestion) => {
    const candidates = [
      report.categoryName,
      report.categorySlug,
    ].filter((value): value is string => !!value && value.trim().length > 0);

    for (const candidate of candidates) {
      const normalizedCandidate = normalizeCategoryValue(candidate);
      const matched = categories.find(
        (category) => normalizeCategoryValue(category) === normalizedCandidate,
      );
      if (matched) {
        return matched;
      }
    }

    return '';
  };

  const closeReportEditor = () => {
    setIsReportEditorOpen(false);
    setReportEditorState(null);
  };

  const openReportEditor = (report: ReportedQuestion) => {
    const derivedCategory = resolveCategoryFromReport(report);
    const normalizedOptions = Array.from({ length: 4 }, (_, index) => {
      const value = report.options[index] ?? '';
      return value;
    });

    const validCorrectIndex =
      typeof report.correctAnswerIndex === 'number' &&
      report.correctAnswerIndex >= 0 &&
      report.correctAnswerIndex < normalizedOptions.length
        ? report.correctAnswerIndex
        : 0;

    const reporterInfoParts: string[] = [];
    if (report.reporterUsername) {
      reporterInfoParts.push(report.reporterUsername);
    }
    if (report.reporterId) {
      reporterInfoParts.push(`(${report.reporterId})`);
    }

    const reporterInfo = reporterInfoParts.length > 0 ? reporterInfoParts.join(' ') : 'Bilinmeyen kullanıcı';

    setReportEditorState({
      reportId: report.id,
      question: report.questionText ?? '',
      category: derivedCategory,
      options: normalizedOptions,
      correctAnswer: String(validCorrectIndex),
      reason: report.reason,
      reporterInfo,
      reportedAtLabel: formatReportedDate(report.reportedAt),
      original: report,
    });
    setIsReportEditorOpen(true);
  };

  const handleReportEditorQuestionChange = (value: string) => {
    setReportEditorState((prev) => (prev ? { ...prev, question: value } : prev));
  };

  const handleReportEditorCategoryChange = (value: string) => {
    setReportEditorState((prev) => (prev ? { ...prev, category: value } : prev));
  };

  const updateReportEditorOption = (index: number, value: string) => {
    setReportEditorState((prev) => {
      if (!prev) {
        return prev;
      }

      const updatedOptions = [...prev.options];
      updatedOptions[index] = value;
      return { ...prev, options: updatedOptions };
    });
  };

  const handleReportEditorCorrectAnswerChange = (value: string) => {
    setReportEditorState((prev) => (prev ? { ...prev, correctAnswer: value } : prev));
  };

  const handleReportEditorSubmit = () => {
    if (!reportEditorState) {
      return;
    }

    const trimmedQuestion = reportEditorState.question.trim();
    if (!trimmedQuestion) {
      toast.error('Soru metni boş olamaz!');
      return;
    }

    const trimmedOptions = reportEditorState.options.map((option) => option.trim());
    if (trimmedOptions.some((option) => option.length === 0)) {
      toast.error('Tüm seçenekleri doldurunuz!');
      return;
    }

    const correctIndex = Number.parseInt(reportEditorState.correctAnswer, 10);
    if (!Number.isFinite(correctIndex) || correctIndex < 0 || correctIndex >= trimmedOptions.length) {
      toast.error('Lütfen doğru cevabı seçin!');
      return;
    }

    const selectedCategory =
      reportEditorState.category ||
      reportEditorState.original.categoryName ||
      '';

    if (!selectedCategory) {
      toast.error('Kategori seçiniz!');
      return;
    }

    onAddQuestion({
      question: trimmedQuestion,
      category: selectedCategory,
      options: trimmedOptions,
      correctAnswer: correctIndex,
    });

    toast.success('Raporlanan soru taslaklara eklendi.');
    closeReportEditor();
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validasyon
    if (!questionText.trim()) {
      toast.error('Soru metni boş olamaz!');
      return;
    }

    if (!selectedCategory) {
      toast.error('Kategori seçiniz!');
      return;
    }

    if (options.some(opt => !opt.trim())) {
      toast.error('Tüm seçenekleri doldurunuz!');
      return;
    }

    // Soruyu ekle
    const newQuestion: Omit<Question, 'id'> = {
      question: questionText,
      category: selectedCategory,
      options: options,
      correctAnswer: parseInt(correctAnswer)
    };

    onAddQuestion(newQuestion);
    toast.success('Soru başarıyla eklendi!');

    // Formu temizle
    setQuestionText('');
    setSelectedCategory('');
    setOptions(['', '', '', '']);
    setCorrectAnswer('0');
  };

  const handleSendQuestions = async () => {
    if (questions.length === 0 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitAll(questions);
      toast.success('Sorular sunucuya gönderildi!');
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'Sorular gönderilemedi, lütfen tekrar deneyin.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 p-4 pt-20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-primary mb-2">Admin Paneli</h1>
          <p className="text-muted-foreground">Quize yeni sorular ekleyin ve mevcut soruları yönetin</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Soru Ekleme Formu */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5" />
                Yeni Soru Ekle
              </CardTitle>
              <CardDescription>
                Sorunuzu yazın, seçenekleri girin ve doğru cevabı seçin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Kategori Seçimi */}
                <div className="space-y-2">
                  <Label htmlFor="category">Kategori</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Kategori seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Soru Metni */}
                <div className="space-y-2">
                  <Label htmlFor="question">Soru</Label>
                  <Input
                    id="question"
                    placeholder="Sorunuzu yazın..."
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                  />
                </div>

                {/* Seçenekler */}
                <div className="space-y-2">
                  <Label>Seçenekler</Label>
                  <RadioGroup value={correctAnswer} onValueChange={setCorrectAnswer}>
                    {options.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                        <Label htmlFor={`option-${index}`} className="sr-only">
                          Seçenek {index + 1}
                        </Label>
                        <Input
                          placeholder={`${index + 1}. Seçenek`}
                          value={option}
                          onChange={(e) => handleOptionChange(index, e.target.value)}
                          className="flex-1"
                        />
                      </div>
                    ))}
                  </RadioGroup>
                  <p className="text-muted-foreground text-sm">
                    Doğru cevabı seçmek için yanındaki radio butonunu işaretleyin
                  </p>
                </div>

                <Button type="submit" className="w-full" size="lg">
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Soru Ekle
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Eklenen Sorular Listesi */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="w-5 h-5" />
                Eklenen Sorular ({questions.length})
              </CardTitle>
              <CardDescription>
                Sisteme eklediğiniz özel sorular
              </CardDescription>
            </CardHeader>
            <CardContent>
              {questions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Henüz özel soru eklenmedi.</p>
                  <p className="text-sm mt-2">Sol taraftaki formu kullanarak yeni sorular ekleyebilirsiniz.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4 max-h-[500px] overflow-y-auto">
                    {questions.map((q) => (
                      <Card key={q.id} className="border-2">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                  {q.category}
                                </span>
                              </div>
                              <p className="mb-2">{q.question}</p>
                              <ul className="space-y-1 text-sm">
                                {q.options.map((opt, idx) => (
                                  <li
                                    key={idx}
                                    className={`flex items-center gap-2 ${
                                      idx === q.correctAnswer ? 'text-green-600' : 'text-muted-foreground'
                                    }`}
                                  >
                                    {idx === q.correctAnswer && <span>✓</span>}
                                    {opt}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => {
                                onDeleteQuestion(q.id);
                                toast.success('Soru silindi');
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <Button
                    className="w-full mt-4"
                    size="lg"
                    onClick={handleSendQuestions}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Gönderiliyor...' : 'Soruları Gönder'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-6">
          <Card>
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  Raporlanan Sorular ({reportedCount})
                </CardTitle>
                <CardDescription>
                  Kullanıcılar tarafından bildirilen soruları inceleyebilir ve gerekli aksiyonları planlayabilirsiniz.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!isFetchingReports) {
                    loadReportedQuestions().catch(() => {});
                  }
                }}
                disabled={isFetchingReports}
                className="inline-flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isFetchingReports ? 'animate-spin' : ''}`} />
                Yenile
              </Button>
            </CardHeader>
            <CardContent>
              {isFetchingReports ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Raporlar yükleniyor...</span>
                </div>
              ) : fetchReportsError ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-destructive">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    <span>{fetchReportsError}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      loadReportedQuestions().catch(() => {});
                    }}
                  >
                    Tekrar Dene
                  </Button>
                </div>
              ) : reportedQuestions.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <p>Şu anda bildirilen soru bulunmuyor.</p>
                  <p className="text-sm mt-2">Kullanıcılar bir sorun bildirdiğinde burada listelenecek.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {reportedQuestions.map((report) => {
                    const reportedDate = formatReportedDate(report.reportedAt);
                    const correctIndex =
                      typeof report.correctAnswerIndex === 'number' &&
                      report.correctAnswerIndex >= 0 &&
                      report.correctAnswerIndex < OPTION_LETTERS.length
                        ? report.correctAnswerIndex
                        : null;
                    const correctLetter = typeof correctIndex === 'number' ? OPTION_LETTERS[correctIndex] : null;
                    const correctText = typeof correctIndex === 'number' ? report.options[correctIndex] ?? null : null;
                    const reporterName = report.reporterUsername ?? report.reporterId ?? null;
                    return (
                      <div
                        key={`${report.id}-${report.questionId ?? 'unknown'}`}
                        className="rounded-lg border p-4 space-y-3 transition cursor-pointer hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                        role="button"
                        tabIndex={0}
                        onClick={() => openReportEditor(report)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openReportEditor(report);
                          }
                        }}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              Rapor ID: {report.id}
                              {typeof report.questionId === 'number' ? ` • Soru ID: ${report.questionId}` : ''}
                              {report.categoryName && (
                                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-primary">
                                  {report.categoryName}
                                </span>
                              )}
                            </div>
                            <p className="font-medium text-base">{report.questionText}</p>
                            {correctLetter && (
                              <div className="text-xs text-muted-foreground">
                                Doğru cevap: {correctLetter}
                                {correctText ? ` • ${correctText}` : ''}
                              </div>
                            )}
                            {reporterName && (
                              <div className="text-xs text-muted-foreground">
                                Bildiren: {reporterName}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-start gap-1 text-xs text-muted-foreground sm:items-end">
                            {report.status && (
                              <span className="inline-flex items-center justify-center rounded-full bg-muted px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                                {report.status}
                              </span>
                            )}
                            {reportedDate && <span>{reportedDate}</span>}
                          </div>
                        </div>
                        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                          {report.reason}
                        </div>
                        <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                          <span>
                            {reporterName ? `Bildiren: ${reporterName}` : 'Bildiren kullanıcı bilgisi yok.'}
                          </span>
                          {!reportedDate && report.reportedAt && <span>{report.reportedAt}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {isReportEditorOpen && reportEditorState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          role="dialog"
          aria-modal="true"
          onClick={closeReportEditor}
        >
          <div
            className="w-full max-w-2xl space-y-6 rounded-lg border bg-background p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Raporlanan Soruyu Düzenle</h2>
              <p className="text-sm text-muted-foreground">
                Rapor ID: {reportEditorState.reportId}
                {typeof reportEditorState.original.questionId === 'number' ? ` • Soru ID: ${reportEditorState.original.questionId}` : ''}
                {reportEditorState.reportedAtLabel ? ` • ${reportEditorState.reportedAtLabel}` : ''}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Rapor Sebebi</Label>
              <Textarea
                value={reportEditorState.reason}
                readOnly
                className="min-h-[80px] bg-muted/60"
              />
              <p className="text-xs text-muted-foreground">
                Raporu inceleyin ve gerekiyorsa soruyu düzenleyip taslaklara ekleyin.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="report-question">Soru</Label>
                <Textarea
                  id="report-question"
                  value={reportEditorState.question}
                  onChange={(event) => handleReportEditorQuestionChange(event.target.value)}
                  className="min-h-[120px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="report-category">Kategori</Label>
                <Select
                  value={reportEditorState.category}
                  onValueChange={handleReportEditorCategoryChange}
                >
                  <SelectTrigger id="report-category">
                    <SelectValue placeholder="Kategori seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {reportEditorState.original.categoryName && (
                  <p className="text-xs text-muted-foreground">
                    Orijinal kategori: {reportEditorState.original.categoryName}
                    {reportEditorState.original.categorySlug ? ` (${reportEditorState.original.categorySlug})` : ''}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label>Seçenekler</Label>
                <RadioGroup
                  value={reportEditorState.correctAnswer}
                  onValueChange={handleReportEditorCorrectAnswerChange}
                >
                  {reportEditorState.options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <RadioGroupItem value={index.toString()} id={`report-option-${index}`} />
                      <Label htmlFor={`report-option-${index}`} className="sr-only">
                        {`Seçenek ${OPTION_LETTERS[index]}`}
                      </Label>
                      <Input
                        value={option}
                        onChange={(event) => updateReportEditorOption(index, event.target.value)}
                        placeholder={`${OPTION_LETTERS[index]}. seçeneği düzenleyin`}
                        className="flex-1"
                      />
                    </div>
                  ))}
                </RadioGroup>
                <p className="text-xs text-muted-foreground">
                  Doğru cevabı radio butonu ile işaretleyin.
                </p>
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                <span>Bildiren: {reportEditorState.reporterInfo}</span>
                {reportEditorState.reportedAtLabel && <span>Rapor Tarihi: {reportEditorState.reportedAtLabel}</span>}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={closeReportEditor}>
                Kapat
              </Button>
              <Button onClick={handleReportEditorSubmit}>
                Taslaklara Ekle
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

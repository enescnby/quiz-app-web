import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import { CheckCircle2, XCircle, Trophy, ArrowRight, Home, Loader2, AlertTriangle, RefreshCw, Flag } from "lucide-react";
import { toast } from "sonner@2.0.3";
import { Category } from "./CategorySelection";

export interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  category: string;
}

interface QuizPageProps {
  category?: Category;
  gameMode?: "solo" | "duel";
  questions?: Question[];
  isLoadingQuestions?: boolean;
  errorMessage?: string | null;
  onRetryFetch?: () => void;
  onSubmitGuess?: (questionId: number, answerIndex: number) => Promise<{ isCorrect: boolean; correctOption?: string | null }>;
  onReportQuestion?: (questionId: number, reason: string) => Promise<void>;
  onComplete?: (score: number, total: number) => void;
  onBack?: () => void;
  onExitToHome?: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

const letterToIndex = (letter?: string | null): number | null => {
  if (!letter) {
    return null;
  }
  const normalized = letter.trim().toUpperCase();
  const idx = OPTION_LETTERS.indexOf(normalized as (typeof OPTION_LETTERS)[number]);
  return idx === -1 ? null : idx;
};

export function QuizPage({
  category,
  gameMode = "solo",
  questions: providedQuestions = [],
  isLoadingQuestions = false,
  errorMessage,
  onRetryFetch,
  onSubmitGuess,
  onReportQuestion,
  onComplete,
  onBack,
  onExitToHome,
}: QuizPageProps) {
  const QUESTION_LIMIT = 3;
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [answeredQuestions, setAnsweredQuestions] = useState<number[]>([]);
  const [isCheckingAnswer, setIsCheckingAnswer] = useState(false);
  const [revealedCorrectIndex, setRevealedCorrectIndex] = useState<number | null>(null);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  useEffect(() => {
    if (providedQuestions.length === 0) {
      setQuestions([]);
      resetProgress();
      return;
    }

    const filtered =
      category && category !== "Karışık"
        ? providedQuestions.filter((question) => question.category === category)
        : providedQuestions;

    if (filtered.length === 0) {
      setQuestions([]);
      resetProgress();
      return;
    }

    const shuffled = [...filtered].sort(() => Math.random() - 0.5);
    const limited = shuffled.slice(0, Math.min(QUESTION_LIMIT, filtered.length));

    setQuestions(limited);
    resetProgress();
  }, [category, providedQuestions]);

  const resetProgress = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setAnsweredQuestions([]);
    setScore(0);
    setIsCheckingAnswer(false);
    setRevealedCorrectIndex(null);
    setReportReason("");
    setIsReportDialogOpen(false);
    setIsSubmittingReport(false);
  };

  useEffect(() => {
    setReportReason("");
    setIsReportDialogOpen(false);
    setIsSubmittingReport(false);
  }, [currentQuestionIndex]);

  if (isLoadingQuestions) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center space-y-4">
            <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
            <p className="text-muted-foreground">Sorular yükleniyor...</p>
            <div className="flex flex-wrap justify-center gap-3">
              {onBack && (
                <Button variant="outline" onClick={onBack}>
                  Kategorilere Dön
                </Button>
              )}
              {onExitToHome && (
                <Button onClick={onExitToHome}>
                  Ana Menü
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (errorMessage && providedQuestions.length === 0) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center space-y-4">
            <AlertTriangle className="w-10 h-10 mx-auto text-destructive" />
            <p className="text-muted-foreground">{errorMessage}</p>
            <div className="flex flex-wrap justify-center gap-3">
              {onRetryFetch && (
                <Button onClick={onRetryFetch}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Tekrar Dene
                </Button>
              )}
              {onBack && (
                <Button variant="outline" onClick={onBack}>
                  Kategorilere Dön
                </Button>
              )}
              {onExitToHome && (
                <Button onClick={onExitToHome}>
                  Ana Menü
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center space-y-4">
            <p className="text-muted-foreground">
              {providedQuestions.length === 0
                ? "Henüz soru bulunmuyor."
                : "Bu kategori için soru bulunamadı."}
            </p>
            <div className="flex justify-center gap-3">
              {onBack && (
                <Button variant="outline" onClick={onBack}>
                  Kategorilere Dön
                </Button>
              )}
              {onExitToHome && (
                <Button onClick={onExitToHome}>
                  Ana Menü
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  const handleAnswerSelect = async (answerIndex: number) => {
    if (answeredQuestions.includes(currentQuestionIndex) || isCheckingAnswer) {
      return;
    }

    setSelectedAnswer(answerIndex);
    setIsCheckingAnswer(true);

    try {
      let result: { isCorrect: boolean; correctOption?: string | null } | undefined;

      if (onSubmitGuess) {
        result = await onSubmitGuess(currentQuestion.id, answerIndex);
      }

      const correctIndexFromServer = letterToIndex(result?.correctOption ?? null);
      const fallbackIndex = result?.isCorrect ? answerIndex : currentQuestion.correctAnswer;
      const effectiveCorrectIndex = correctIndexFromServer ?? fallbackIndex;
      const isCorrect = result ? result.isCorrect : answerIndex === effectiveCorrectIndex;

      console.info('[Qio] Guess result', {
        questionId: currentQuestion.id,
        selectedIndex: answerIndex,
        selectedLetter: OPTION_LETTERS[answerIndex] ?? null,
        backendResponse: result,
        resolvedCorrectIndex: effectiveCorrectIndex,
        resolvedCorrectLetter: OPTION_LETTERS[effectiveCorrectIndex] ?? null,
        isCorrect,
      });

      setQuestions((prev) =>
        prev.map((question, idx) =>
          idx === currentQuestionIndex ? { ...question, correctAnswer: effectiveCorrectIndex } : question
        )
      );

      setRevealedCorrectIndex(effectiveCorrectIndex);

      if (isCorrect) {
        setScore((prev) => prev + 1);
      }

      setAnsweredQuestions((prev) => [...prev, currentQuestionIndex]);
      setShowResult(true);
    } catch (error) {
      console.error('Failed to submit answer guess', error);
      const message = error instanceof Error ? error.message : 'Cevap gönderilirken bir hata oluştu.';
      toast.error(message);
      setSelectedAnswer(null);
    } finally {
      setIsCheckingAnswer(false);
    }
  };

  const handleNextQuestion = () => {
    if (isLastQuestion) {
      onComplete?.(score, questions.length);
      return;
    }

    setCurrentQuestionIndex((prev) => prev + 1);
    setSelectedAnswer(null);
    setShowResult(false);
    setRevealedCorrectIndex(null);
  };

  const getOptionStyle = (index: number) => {
    if (!showResult) {
      return selectedAnswer === index
        ? "border-primary bg-primary/5"
        : "border-border hover:border-primary hover:bg-accent";
    }

    const correctIndex = revealedCorrectIndex ?? currentQuestion.correctAnswer;

    if (index === correctIndex) {
      return "border-green-500 bg-green-50 dark:bg-green-950";
    }

    if (index === selectedAnswer && index !== correctIndex) {
      return "border-destructive bg-destructive/5";
    }

    return "border-border opacity-50";
  };

  const handleReportSubmit = async () => {
    const trimmedReason = reportReason.trim();

    if (!trimmedReason) {
      toast.error("Lütfen bir rapor gerekçesi girin.");
      return;
    }

    if (!onReportQuestion) {
      toast.error("Rapor gönderilemiyor.");
      return;
    }

    setIsSubmittingReport(true);

    try {
      await onReportQuestion(currentQuestion.id, trimmedReason);
      toast.success("Raporunuz gönderildi. Teşekkürler!");
      setIsReportDialogOpen(false);
      setReportReason("");
    } catch (error) {
      console.error("Soru raporu gönderilirken bir hata oluştu", error);
      const message = error instanceof Error ? error.message : "Soru raporu gönderilemedi.";
      toast.error(message);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const closeReportDialog = () => {
    if (isSubmittingReport) {
      return;
    }
    setIsReportDialogOpen(false);
    setReportReason("");
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <Card className="shadow-xl">
          <CardHeader>
            <div className="flex w-full items-center justify-between mb-4">
              <Badge variant="secondary">{currentQuestion.category}</Badge>
              <div className="ml-auto flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                <span>{score} / {questions.length}</span>
              </div>
            </div>
            <div className="flex w-full items-center justify-between gap-4">
              <CardTitle className="text-lg">
                Soru {currentQuestionIndex + 1} / {questions.length}
              </CardTitle>
              <div className="flex items-center gap-2">
                {onBack && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBack}
                    className="shrink-0"
                  >
                    Kategori
                  </Button>
                )}
                {onExitToHome && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onExitToHome}
                    className="shrink-0"
                  >
                    <Home className="mr-2 h-4 w-4" />
                    Ana Menü
                  </Button>
                )}
              </div>
            </div>
            <CardDescription>
              <Progress value={progress} className="mt-2" />
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-accent/50 rounded-lg p-6">
              <p className="text-foreground">{currentQuestion.question}</p>
            </div>

            {onReportQuestion && (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsReportDialogOpen(true)}
                  className="text-destructive inline-flex items-center gap-2"
                >
                  <Flag className="h-4 w-4" />
                  Soruyu Bildir
                </Button>
              </div>
            )}

            <div className="grid gap-3">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={answeredQuestions.includes(currentQuestionIndex) || isCheckingAnswer}
                  className={`
                    relative w-full p-4 rounded-lg border-2 transition-all text-left
                    disabled:cursor-not-allowed
                    ${getOptionStyle(index)}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`
                        w-8 h-8 rounded-full flex items-center justify-center border-2
                        ${showResult && index === (revealedCorrectIndex ?? currentQuestion.correctAnswer)
                          ? "bg-green-500 border-green-500 text-white"
                          : showResult && index === selectedAnswer
                          ? "bg-destructive border-destructive text-destructive-foreground"
                          : "bg-background border-border"
                        }
                      `}
                      >
                        {String.fromCharCode(65 + index)}
                      </div>
                      <span>{option}</span>
                    </div>
                    {showResult && index === (revealedCorrectIndex ?? currentQuestion.correctAnswer) && (
                      <CheckCircle2 className="w-6 h-6 text-green-500" />
                    )}
                    {showResult &&
                      index === selectedAnswer &&
                      index !== (revealedCorrectIndex ?? currentQuestion.correctAnswer) && (
                        <XCircle className="w-6 h-6 text-destructive" />
                      )}
                  </div>
                </button>
              ))}
            </div>

            {showResult && (
              <div
                className={`
                p-4 rounded-lg border-2 text-center
                ${selectedAnswer !== null && selectedAnswer === (revealedCorrectIndex ?? currentQuestion.correctAnswer)
                  ? "bg-green-50 border-green-500 dark:bg-green-950"
                  : "bg-destructive/5 border-destructive"
                }
              `}
              >
                {selectedAnswer !== null && selectedAnswer === (revealedCorrectIndex ?? currentQuestion.correctAnswer) ? (
                  <p className="text-green-700 dark:text-green-300">
                    ✓ Doğru cevap! Tebrikler.
                  </p>
                ) : (
                  <p className="text-destructive">
                    ✗ Yanlış cevap. Doğru cevap:{" "}
                    {currentQuestion.options[revealedCorrectIndex ?? currentQuestion.correctAnswer]}
                  </p>
                )}
              </div>
            )}

            {showResult && (
              <Button onClick={handleNextQuestion} className="w-full" size="lg">
                {isLastQuestion ? (
                  <>
                    Tamamla
                    <Trophy className="ml-2 w-5 h-5" />
                  </>
                ) : (
                  <>
                    Sonraki Soru
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </>
                )}
              </Button>
            )}

            {onReportQuestion && (
              isReportDialogOpen && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
                  onClick={closeReportDialog}
                  role="dialog"
                  aria-modal="true"
                >
                  <div
                    className="w-full max-w-lg rounded-lg border bg-background p-6 shadow-xl"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="mb-4 space-y-2">
                      <h2 className="text-lg font-semibold">Soruyu Bildir</h2>
                      <p className="text-sm text-muted-foreground">
                        Karşılaştığınız sorunu kısaca açıklayın. Ekibimiz bildiriminizi inceleyecektir.
                      </p>
                    </div>
                    <Textarea
                      value={reportReason}
                      onChange={(event) => setReportReason(event.target.value)}
                      placeholder="Örnek: Soru yanlış cevap anahtarı içeriyor."
                      className="min-h-[120px]"
                      disabled={isSubmittingReport}
                    />
                    <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <Button
                        variant="outline"
                        onClick={closeReportDialog}
                        disabled={isSubmittingReport}
                      >
                        Vazgeç
                      </Button>
                      <Button onClick={handleReportSubmit} disabled={isSubmittingReport}>
                        {isSubmittingReport && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Gönder
                      </Button>
                    </div>
                  </div>
                </div>
              )
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

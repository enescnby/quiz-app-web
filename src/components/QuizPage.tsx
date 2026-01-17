import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { CheckCircle2, XCircle, Trophy, ArrowRight, Home, Loader2, AlertTriangle, RefreshCw, Flag, Copy, Users, Clock } from "lucide-react";
import { toast } from "sonner@2.0.3";
import { Category } from "./CategorySelection";

export type QuestionId = number | string;

export interface Question {
  id: QuestionId;
  question: string;
  options: string[];
  correctAnswer: number;
  category: string;
}

export type DuelPlayer = {
  name?: string;
  score?: number;
  correct?: number;
  wrong?: number;
  answered?: number;
  isSelf?: boolean;
};

interface QuizPageProps {
  category?: Category;
  gameMode?: "solo" | "duel";
  questions?: Question[];
  isLoadingQuestions?: boolean;
  errorMessage?: string | null;
  onRetryFetch?: () => void;
  onSubmitGuess?: (questionId: QuestionId, answerIndex: number) => Promise<{
    isCorrect: boolean;
    correctOption?: string | null;
    playerScore?: number;
    opponentScore?: number;
    status?: string | null;
    isCompleted?: boolean;
  }>;
  onReportQuestion?: (questionId: QuestionId, reason: string) => Promise<void>;
  onComplete?: (score: number, total: number) => void;
  onBack?: () => void;
  onExitToHome?: () => void;
  duelSessionCode?: string | null;
  duelStatus?: string | null;
  duelPlayers?: DuelPlayer[];
  duelScores?: { player: number; opponent: number };
  onStartDuelSession?: () => Promise<unknown>;
  onJoinDuelSession?: (code: string) => Promise<unknown>;
  onRefreshDuelSession?: () => Promise<unknown>;
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
  duelSessionCode,
  duelStatus,
  duelPlayers,
  duelScores,
  onStartDuelSession,
  onJoinDuelSession,
  onRefreshDuelSession,
}: QuizPageProps) {
  const SOLO_QUESTION_LIMIT = 3;
  const isDuelMode = gameMode === "duel";
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
  const [duelJoinCode, setDuelJoinCode] = useState("");
  const [isStartingDuel, setIsStartingDuel] = useState(false);
  const [isJoiningDuel, setIsJoiningDuel] = useState(false);
  const [isRefreshingDuel, setIsRefreshingDuel] = useState(false);

  useEffect(() => {
    if (providedQuestions.length === 0) {
      setQuestions([]);
      resetProgress();
      return;
    }

    const filtered =
      category && category !== "Karışık" && !isDuelMode
        ? providedQuestions.filter((question) => question.category === category)
        : providedQuestions;

    if (filtered.length === 0) {
      setQuestions([]);
      resetProgress();
      return;
    }

    const shuffled = isDuelMode ? filtered : [...filtered].sort(() => Math.random() - 0.5);
    const limited = isDuelMode ? shuffled : shuffled.slice(0, Math.min(SOLO_QUESTION_LIMIT, filtered.length));

    setQuestions((previous) => {
      const prevIds = previous.map((question) => question.id).join(',');
      const nextIds = limited.map((question) => question.id).join(',');
      const shouldResetProgress = !isDuelMode || previous.length === 0 || prevIds !== nextIds;

      if (shouldResetProgress) {
        resetProgress();
      }

      return limited;
    });
  }, [category, providedQuestions, isDuelMode, SOLO_QUESTION_LIMIT]);

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

  const handleStartDuelSession = async () => {
    if (!onStartDuelSession) {
      toast.error("Düello başlatma desteği bulunamadı.");
      return;
    }
    setIsStartingDuel(true);
    try {
      await onStartDuelSession();
      toast.success("Düello oturumu oluşturuldu. Kodunla rakibini davet et!");
    } catch (error) {
      console.error("Düello başlatılamadı", error);
      const message = error instanceof Error ? error.message : "Düello başlatılamadı.";
      toast.error(message);
    } finally {
      setIsStartingDuel(false);
    }
  };

  const handleJoinDuelSession = async () => {
    if (!onJoinDuelSession) {
      toast.error("Düello katılımı desteklenmiyor.");
      return;
    }

    const trimmedCode = duelJoinCode.trim();
    if (!trimmedCode) {
      toast.error("Lütfen geçerli bir düello kodu girin.");
      return;
    }

    setIsJoiningDuel(true);
    try {
      await onJoinDuelSession(trimmedCode);
      toast.success("Düello oturumuna katıldın!");
    } catch (error) {
      console.error("Düello oturumuna katılınamadı", error);
      const message = error instanceof Error ? error.message : "Düello oturumuna katılınamadı.";
      toast.error(message);
    } finally {
      setIsJoiningDuel(false);
    }
  };

  const handleRefreshDuelSession = async () => {
    if (!onRefreshDuelSession) {
      toast.error("Düello oturumu yenilenemedi.");
      return;
    }

    setIsRefreshingDuel(true);
    try {
      await onRefreshDuelSession();
      toast.success("Düello oturumu güncellendi.");
    } catch (error) {
      console.error("Düello oturumu yenilenemedi", error);
      const message = error instanceof Error ? error.message : "Düello oturumu yenilenemedi.";
      toast.error(message);
    } finally {
      setIsRefreshingDuel(false);
    }
  };

  const handleCopyDuelCode = async () => {
    if (!duelSessionCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(duelSessionCode);
      toast.success("Düello kodu kopyalandı.");
    } catch (error) {
      console.error("Düello kodu kopyalanamadı", error);
      toast.error("Kodu kopyalarken bir hata oluştu.");
    }
  };

  useEffect(() => {
    setReportReason("");
    setIsReportDialogOpen(false);
    setIsSubmittingReport(false);
  }, [currentQuestionIndex]);

  const hasOpponent = isDuelMode && (duelPlayers?.length ?? 0) >= 2;

  if (isLoadingQuestions) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
            <CardContent className="p-6 text-center space-y-4">
              <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
              <p className="text-muted-foreground">{isDuelMode ? "Düello hazırlanıyor..." : "Sorular yükleniyor..."}</p>
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

  if (!isDuelMode && errorMessage && providedQuestions.length === 0) {
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

  if (isDuelMode && !duelSessionCode && !isLoadingQuestions) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-3xl">
          <CardHeader className="space-y-2">
            <CardTitle>Düello Lobi</CardTitle>
            <CardDescription>
              {category ? `${category} kategorisinde 10 soruluk bir düello başlat veya bir koda katıl.` : 'Bir kategori seçerek düello oluşturabilir veya mevcut koda katılabilirsin.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorMessage && (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-destructive text-sm">
                {errorMessage}
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-4 space-y-3 bg-primary/5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Yeni düello başlat</h3>
                  <Badge variant="secondary">10 Soru</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Kategori: {category ?? "Genel Kültür"}
                </p>
                <Button
                  onClick={handleStartDuelSession}
                  disabled={!onStartDuelSession || isStartingDuel}
                  className="w-full"
                >
                  {isStartingDuel && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Düello oluştur
                </Button>
              </div>
              <div className="rounded-lg border p-4 space-y-3">
                <h3 className="font-semibold">Mevcut koda katıl</h3>
                <p className="text-sm text-muted-foreground">Davet kodunu girerek rakibine katıl.</p>
                <div className="flex flex-col gap-2">
                  <Input
                    placeholder="Örn: ABC123"
                    value={duelJoinCode}
                    onChange={(event) => setDuelJoinCode(event.target.value)}
                    disabled={!onJoinDuelSession || isJoiningDuel}
                  />
                  <Button
                    onClick={handleJoinDuelSession}
                    disabled={!onJoinDuelSession || isJoiningDuel}
                    className="w-full"
                  >
                    {isJoiningDuel && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Koda Katıl
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {onBack && (
                <Button variant="outline" onClick={onBack}>
                  Kategorilere Dön
                </Button>
              )}
              {onExitToHome && (
                <Button onClick={onExitToHome}>
                  <Home className="mr-2 h-4 w-4" />
                  Ana Menü
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isDuelMode && !hasOpponent) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-3xl">
          <CardHeader className="space-y-2">
            <CardTitle>Rakip Bekleniyor</CardTitle>
            <CardDescription>
              Rakip katılana kadar sorular görünmez. Düello kodunu paylaşarak davet et.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {duelSessionCode && (
                <Badge variant="outline" className="flex items-center gap-2 text-sm">
                  Kod: {duelSessionCode}
                  <button
                    type="button"
                    onClick={handleCopyDuelCode}
                    className="inline-flex items-center gap-1 text-xs underline underline-offset-2"
                  >
                    <Copy className="h-3 w-3" />
                    kopyala
                  </button>
                </Badge>
              )}
              <Badge variant="secondary">Hazırlanıyor</Badge>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {onRefreshDuelSession && (
                <Button onClick={handleRefreshDuelSession} disabled={isRefreshingDuel}>
                  {isRefreshingDuel ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Oturumu Yenile
                </Button>
              )}
              {onBack && (
                <Button variant="outline" onClick={onBack}>
                  Kategorilere Dön
                </Button>
              )}
              {onExitToHome && (
                <Button onClick={onExitToHome}>
                  <Home className="mr-2 h-4 w-4" />
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
    const emptyMessage = isDuelMode
      ? (errorMessage ?? (duelSessionCode ? "Düello oturumu için soru bulunamadı, lütfen oturumu yenileyin." : "Düello oturumu hazır değil."))
      : (providedQuestions.length === 0
        ? "Henüz soru bulunmuyor."
        : "Bu kategori için soru bulunamadı.");

    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center space-y-4">
            <p className="text-muted-foreground">{emptyMessage}</p>
            <div className="flex flex-wrap justify-center gap-3">
              {isDuelMode && onRefreshDuelSession && (
                <Button onClick={handleRefreshDuelSession}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Oturumu Yenile
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

  const duelScoreBoard = duelScores ?? { player: score, opponent: 0 };
  const playerA = duelPlayers?.[0];
  const playerB = duelPlayers?.[1];
  const playerAName = playerA?.name || "Oyuncu 1";
  const playerBName = playerB?.name || "Oyuncu 2";
  const playerAnswers = playerA?.answered ?? answeredQuestions.length;
  const opponentAnswers = playerB?.answered ?? 0;
  const waitingForOpponentAnswer = isDuelMode && showResult && playerAnswers > opponentAnswers;
  const opponentAnsweredCurrent = isDuelMode && opponentAnswers >= playerAnswers && opponentAnswers > 0;
  const currentQuestion = questions[currentQuestionIndex];
  const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  const handleAnswerSelect = async (answerIndex: number) => {
    if (answeredQuestions.includes(currentQuestionIndex) || isCheckingAnswer) {
      return;
    }

    if (isDuelMode && !duelSessionCode) {
      toast.error("Önce düello oturumu başlatın veya katılın.");
      return;
    }

    setSelectedAnswer(answerIndex);
    setIsCheckingAnswer(true);

    try {
      let result: { isCorrect: boolean; correctOption?: string | null } | undefined;

      if (onSubmitGuess) {
        result = await onSubmitGuess(currentQuestion.id, answerIndex);
      } else if (isDuelMode) {
        throw new Error('Düello cevabı gönderilemedi.');
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

      if (isDuelMode && typeof result?.playerScore === "number") {
        setScore(result.playerScore);
      } else if (isCorrect) {
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
                {isDuelMode ? (
                  <>
                    {opponentAnsweredCurrent && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-500">
                        Rakip cevapladı
                      </Badge>
                    )}
                    <Users className="w-5 h-5 text-purple-600" />
                    <div className="text-right">
                      <div className="text-sm font-semibold">{playerAName}: {duelScoreBoard.player}</div>
                      <div className="text-xs text-muted-foreground">{playerBName}: {duelScoreBoard.opponent}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    <span>{score} / {questions.length}</span>
                  </>
                )}
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
            {isDuelMode && (
              <div className="flex flex-wrap items-center gap-2">
                {duelSessionCode && (
                  <Badge variant="outline" className="flex items-center gap-2 text-sm">
                    Kod: {duelSessionCode}
                    <button
                      type="button"
                      onClick={handleCopyDuelCode}
                      className="inline-flex items-center gap-1 text-xs underline underline-offset-2"
                    >
                      <Copy className="h-3 w-3" />
                      kopyala
                    </button>
                  </Badge>
                )}
                {duelStatus && (
                  <Badge variant="secondary" className="capitalize">
                    {duelStatus}
                  </Badge>
                )}
                {onRefreshDuelSession && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefreshDuelSession}
                    disabled={isRefreshingDuel}
                    className="ml-auto"
                  >
                    {isRefreshingDuel ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Yenile
                  </Button>
                )}
              </div>
            )}
            <CardDescription>
              <Progress value={progress} className="mt-2" />
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isDuelMode && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3 bg-primary/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="font-semibold">{playerAName}</span>
                    </div>
                    <Badge variant="secondary">{duelScoreBoard.player} puan</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(playerA?.name && `@${playerA.name} · `) || ''}Doğru {playerA?.correct ?? 0} · Yanlış {playerA?.wrong ?? 0} · Yanıt {playerA?.answered ?? answeredQuestions.length}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{playerBName}</span>
                    </div>
                    <Badge variant="outline">{duelScoreBoard.opponent} puan</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Doğru {playerB?.correct ?? 0} · Yanlış {playerB?.wrong ?? 0} · Yanıt {playerB?.answered ?? 0}
                  </p>
                </div>
              </div>
            )}

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
                {waitingForOpponentAnswer && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Rakibin cevabı bekleniyor...
                  </p>
                )}
                {!waitingForOpponentAnswer && opponentAnsweredCurrent && (
                  <p className="mt-2 text-sm text-green-700 dark:text-green-300">
                    Rakip bu soruyu cevapladı.
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

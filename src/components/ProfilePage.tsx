import type { ComponentType } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { Trophy, Target, TrendingUp, Award, Loader2, User, Users } from "lucide-react";

interface QuizStats {
  userId?: string;
  totalScore: number;
  soloScore: number;
  soloCorrectAnswers: number;
  soloWrongAnswers: number;
  duelScore: number;
  duelCorrectAnswers: number;
  duelWrongAnswers: number;
  totalQuizzesPlayed: number;
  totalCorrectAnswers: number;
}

interface CategoryStat {
  name: string;
  completed: number;
  score: number;
}

interface Achievement {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  unlocked: boolean;
}

interface ProfilePageProps {
  userName: string;
  userEmail: string;
  stats?: QuizStats;
  isLoading?: boolean;
  errorMessage?: string | null;
  onRetryFetchStats?: () => void;
  categoryStats?: CategoryStat[];
  achievements?: Achievement[];
}

export function ProfilePage({
  userName,
  userEmail,
  stats,
  isLoading,
  errorMessage,
  onRetryFetchStats,
  categoryStats = [],
  achievements = [],
}: ProfilePageProps) {

  const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  };

  const totalWrongAnswers = (stats?.soloWrongAnswers ?? 0) + (stats?.duelWrongAnswers ?? 0);
  const totalCorrectAnswers = stats?.totalCorrectAnswers ?? 0;
  const totalAnsweredQuestions = totalCorrectAnswers + totalWrongAnswers;
  const successRate =
    totalAnsweredQuestions > 0
      ? Math.round((totalCorrectAnswers / totalAnsweredQuestions) * 100)
      : 0;

  const soloAnsweredQuestions =
    (stats?.soloCorrectAnswers ?? 0) + (stats?.soloWrongAnswers ?? 0);
  const duelAnsweredQuestions =
    (stats?.duelCorrectAnswers ?? 0) + (stats?.duelWrongAnswers ?? 0);

  const soloSuccessRate =
    soloAnsweredQuestions > 0
      ? Math.round(((stats?.soloCorrectAnswers ?? 0) / soloAnsweredQuestions) * 100)
      : 0;

  const duelSuccessRate =
    duelAnsweredQuestions > 0
      ? Math.round(((stats?.duelCorrectAnswers ?? 0) / duelAnsweredQuestions) * 100)
      : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 pt-20 pb-8 px-4">
        <div className="container max-w-4xl mx-auto">
          <Card className="text-center">
            <CardContent className="py-12 space-y-4">
              <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
              <p className="text-muted-foreground">İstatistikler yükleniyor...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 pt-20 pb-8 px-4">
        <div className="container max-w-4xl mx-auto">
          <Card className="text-center border-destructive/30">
            <CardHeader>
              <CardTitle>İstatistikler yüklenemedi</CardTitle>
              <CardDescription>{errorMessage}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Lütfen daha sonra tekrar deneyin. Sorun devam ederse destek ekibimizle iletişime geçebilirsiniz.
              </p>
              {onRetryFetchStats && (
                <Button onClick={onRetryFetchStats} className="w-full sm:w-auto">
                  Tekrar Dene
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 pt-20 pb-8 px-4">
      <div className="container max-w-6xl mx-auto">
        {/* Profil Başlığı */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              <Avatar className="w-24 h-24">
                <AvatarImage src="" />
                <AvatarFallback className="text-2xl">{getInitials(userName)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl mb-1">{userName}</h2>
                <p className="text-muted-foreground mb-3">{userEmail}</p>
                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                  {stats ? (
                    <>
                      <Badge variant="secondary">
                        <Trophy className="w-3 h-3 mr-1" />
                        {stats.totalScore} Puan
                      </Badge>
                      <Badge variant="secondary">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        {stats.totalQuizzesPlayed} Quiz
                      </Badge>
                      <Badge variant="secondary">
                        <Target className="w-3 h-3 mr-1" />
                        %{successRate} Başarı
                      </Badge>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Performans verileri henüz yüklenmedi.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* İstatistikler */}
          <Card>
            <CardHeader>
              <CardTitle>Genel İstatistikler</CardTitle>
              <CardDescription>Toplam performansın</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {stats ? (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Toplam Quiz</span>
                      <span className="font-semibold">{stats.totalQuizzesPlayed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Toplam Puan</span>
                      <span className="font-semibold">{stats.totalScore}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Doğru / Yanlış</span>
                      <span className="font-semibold">
                        {totalCorrectAnswers} / {totalWrongAnswers}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Başarı Oranı</span>
                      <span className="font-semibold text-green-600">%{successRate}</span>
                    </div>
                    <Progress value={successRate} className="h-2" />
                  </div>

                  <div className="pt-4 border-t space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Solo Puan</span>
                      <span className="font-semibold">{stats.soloScore}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Solo Doğru / Yanlış</span>
                      <span className="font-semibold">
                        {stats.soloCorrectAnswers} / {stats.soloWrongAnswers}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Düello Puan</span>
                      <span className="font-semibold">{stats.duelScore}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Düello Doğru / Yanlış</span>
                      <span className="font-semibold">
                        {stats.duelCorrectAnswers} / {stats.duelWrongAnswers}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  Performans verileri henüz yüklenmedi.
                </div>
              )}
            </CardContent>
          </Card>

        {/* Oyun Modu Performansı ve Başarılar */}
        <Card>
          <CardHeader>
            <CardTitle>Oyun Modu Performansı</CardTitle>
            <CardDescription>Solo ve düello sonuçların</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {stats ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" />
                      <span className="font-semibold">Solo</span>
                    </div>
                    <Badge variant="secondary">Puan: {stats.soloScore}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Doğru / Yanlış: {stats.soloCorrectAnswers} / {stats.soloWrongAnswers}
                  </p>
                  <Progress value={soloSuccessRate} className="h-2 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Başarı Oranı: <span className="font-semibold text-foreground">%{soloSuccessRate}</span>
                  </p>
                </div>
                <div className="p-4 rounded-lg border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      <span className="font-semibold">Düello</span>
                    </div>
                    <Badge variant="secondary">Puan: {stats.duelScore}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Doğru / Yanlış: {stats.duelCorrectAnswers} / {stats.duelWrongAnswers}
                  </p>
                  <Progress value={duelSuccessRate} className="h-2 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Başarı Oranı: <span className="font-semibold text-foreground">%{duelSuccessRate}</span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                Oyun modu performansı henüz yüklenmedi.
              </div>
            )}

            {achievements.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-3">Kazanılan Rozetler</h4>
                <div className="grid grid-cols-2 gap-3">
                  {achievements.map((achievement, index) => {
                    const Icon = achievement.icon;
                    return (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border-2 text-center ${
                          achievement.unlocked
                            ? 'bg-primary/5 border-primary'
                            : 'bg-muted/50 border-muted opacity-50'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center ${
                          achievement.unlocked ? 'bg-primary' : 'bg-muted'
                        }`}>
                          <Icon className={`w-6 h-6 ${achievement.unlocked ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                        </div>
                        <p className="font-medium text-sm mb-1">{achievement.title}</p>
                        <p className="text-xs text-muted-foreground">{achievement.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </div>

        {/* Kategori Bazlı Performans */}
        <Card>
          <CardHeader>
            <CardTitle>Kategori Performansı</CardTitle>
            <CardDescription>Her kategorideki başarın</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryStats.length > 0 ? (
              <div className="space-y-4">
                {categoryStats.map((category, index) => (
                  <div key={index}>
                    <div className="flex justify-between mb-2">
                      <span>{category.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">{category.completed} quiz</span>
                        <span className="font-semibold">%{category.score}</span>
                      </div>
                    </div>
                    <Progress value={category.score} className="h-2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                Kategori performans verileri henüz yüklenmedi.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Trophy, RefreshCcw, Home } from "lucide-react";

interface QuizResultProps {
  score: number;
  total: number;
  onRestart: () => void;
  onBackToHome: () => void;
}

export function QuizResult({ score, total, onRestart, onBackToHome }: QuizResultProps) {
  const percentage = (score / total) * 100;
  
  const getResultMessage = () => {
    if (percentage === 100) return "Mükemmel! 🎉";
    if (percentage >= 80) return "Harika! 🌟";
    if (percentage >= 60) return "İyi! 👍";
    if (percentage >= 40) return "Fena değil! 💪";
    return "Daha fazla çalışmalısın! 📚";
  };

  const getResultColor = () => {
    if (percentage >= 80) return "text-green-600 dark:text-green-400";
    if (percentage >= 60) return "text-blue-600 dark:text-blue-400";
    if (percentage >= 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center">
                <Trophy className="w-10 h-10 text-primary-foreground" />
              </div>
            </div>
            <CardTitle>Quiz Tamamlandı!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Skor */}
            <div className="text-center space-y-2">
              <p className={`${getResultColor()}`}>{getResultMessage()}</p>
              <div className="text-5xl">{score}/{total}</div>
              <p className="text-muted-foreground">doğru cevap</p>
            </div>

            {/* Yüzde Gösterimi */}
            <div className="bg-accent/50 rounded-lg p-6 text-center">
              <p className="text-muted-foreground mb-2">Başarı Oranı</p>
              <p className={`text-4xl ${getResultColor()}`}>
                %{percentage.toFixed(0)}
              </p>
            </div>

            {/* Butonlar */}
            <div className="space-y-3">
              <Button 
                onClick={onRestart} 
                className="w-full"
                size="lg"
              >
                <RefreshCcw className="mr-2 w-5 h-5" />
                Yeniden Başla
              </Button>
              <Button 
                onClick={onBackToHome} 
                variant="outline"
                className="w-full"
                size="lg"
              >
                <Home className="mr-2 w-5 h-5" />
                Ana Sayfa
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

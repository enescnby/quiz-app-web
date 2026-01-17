import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { User, Users, Sparkles } from "lucide-react";
import { Badge } from "./ui/badge";

interface GameModeSelectionProps {
  onSelectMode: (mode: 'solo' | 'duel') => void;
}

export function GameModeSelection({ onSelectMode }: GameModeSelectionProps) {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-primary mb-2">Oyun Modunu Seçin</h1>
          <p className="text-muted-foreground">Nasıl oynamak istersiniz?</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Solo Mod */}
          <Card className="cursor-pointer hover:shadow-xl transition-all hover:-translate-y-1 border-2 hover:border-primary">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 text-white" />
                </div>
              </div>
              <CardTitle className="text-center">Solo Mod</CardTitle>
              <CardDescription className="text-center">
                Kendinizi test edin ve skorunuzu geliştirin
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  <span>Sınırsız soru hakkı</span>
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  <span>Kendi hızınızda ilerleyin</span>
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                  <span>Tüm kategorilere erişim</span>
                </li>
              </ul>
              <Button 
                onClick={() => onSelectMode('solo')} 
                className="w-full"
                size="lg"
              >
                Solo Oyna
              </Button>
            </CardContent>
          </Card>

          {/* Düello Mod */}
          <Card className="relative border-2 hover:border-primary hover:shadow-xl transition-all hover:-translate-y-1">
            <div className="absolute top-4 right-4">
              <Badge variant="outline">Yeni</Badge>
            </div>
            <CardHeader>
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center">
                  <Users className="w-8 h-8 text-white" />
                </div>
              </div>
              <CardTitle className="text-center">Düello Mod</CardTitle>
              <CardDescription className="text-center">
                Arkadaşlarınızla gerçek zamanlı kapışın
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span>Gerçek zamanlı yarış</span>
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span>Arkadaşlarınıza meydan okuyun</span>
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span>Sıralama tablosu</span>
                </li>
              </ul>
              <Button 
                onClick={() => onSelectMode('duel')}
                className="w-full"
                size="lg"
              >
                Düello Başlat
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

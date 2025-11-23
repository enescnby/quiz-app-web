import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Globe, Laptop, History, Trophy, Brain, Palette, Music, FlaskConical, ArrowLeft, Shuffle } from "lucide-react";

export type Category = 
  | 'Coğrafya' 
  | 'Teknoloji' 
  | 'Tarih' 
  | 'Spor' 
  | 'Genel Kültür' 
  | 'Sanat' 
  | 'Müzik'
  | 'Bilim'
  | 'Karışık';

interface CategorySelectionProps {
  onSelectCategory: (category: Category) => void;
  onBack: () => void;
}

interface CategoryOption {
  name: Category;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  description: string;
}

export function CategorySelection({ onSelectCategory, onBack }: CategorySelectionProps) {
  const categories: CategoryOption[] = [
    {
      name: 'Karışık',
      icon: <Shuffle className="w-8 h-8 text-white" />,
      color: 'bg-gradient-to-br from-violet-500 to-fuchsia-500',
      bgColor: 'hover:bg-violet-50 dark:hover:bg-violet-950',
      description: 'Tüm kategorilerden rastgele sorular'
    },
    {
      name: 'Coğrafya',
      icon: <Globe className="w-8 h-8 text-white" />,
      color: 'bg-green-500',
      bgColor: 'hover:bg-green-50 dark:hover:bg-green-950',
      description: 'Ülkeler, başkentler, okyanuslar'
    },
    {
      name: 'Teknoloji',
      icon: <Laptop className="w-8 h-8 text-white" />,
      color: 'bg-blue-500',
      bgColor: 'hover:bg-blue-50 dark:hover:bg-blue-950',
      description: 'Programlama, yazılım, donanım'
    },
    {
      name: 'Tarih',
      icon: <History className="w-8 h-8 text-white" />,
      color: 'bg-amber-500',
      bgColor: 'hover:bg-amber-50 dark:hover:bg-amber-950',
      description: 'Tarihî olaylar ve dönemler'
    },
    {
      name: 'Spor',
      icon: <Trophy className="w-8 h-8 text-white" />,
      color: 'bg-orange-500',
      bgColor: 'hover:bg-orange-50 dark:hover:bg-orange-950',
      description: 'Futbol, basketbol, olimpiyatlar'
    },
    {
      name: 'Genel Kültür',
      icon: <Brain className="w-8 h-8 text-white" />,
      color: 'bg-purple-500',
      bgColor: 'hover:bg-purple-50 dark:hover:bg-purple-950',
      description: 'Çeşitli konulardan sorular'
    },
    {
      name: 'Sanat',
      icon: <Palette className="w-8 h-8 text-white" />,
      color: 'bg-pink-500',
      bgColor: 'hover:bg-pink-50 dark:hover:bg-pink-950',
      description: 'Resim, heykel, mimarlık'
    },
    {
      name: 'Müzik',
      icon: <Music className="w-8 h-8 text-white" />,
      color: 'bg-indigo-500',
      bgColor: 'hover:bg-indigo-50 dark:hover:bg-indigo-950',
      description: 'Müzik türleri ve sanatçılar'
    },
    {
      name: 'Bilim',
      icon: <FlaskConical className="w-8 h-8 text-white" />,
      color: 'bg-cyan-500',
      bgColor: 'hover:bg-cyan-50 dark:hover:bg-cyan-950',
      description: 'Fizik, kimya, biyoloji'
    }
  ];

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl">
        <div className="text-center mb-8">
          <h1 className="text-primary mb-2">Kategori Seçin</h1>
          <p className="text-muted-foreground">Hangi konuda kendinizi test etmek istersiniz?</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {categories.map((category) => (
            <Card
              key={category.name}
              className={`cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 border-2 hover:border-primary ${category.bgColor}`}
              onClick={() => onSelectCategory(category.name)}
            >
              <CardHeader className="text-center pb-3">
                <div className="flex justify-center mb-3">
                  <div className={`w-16 h-16 ${category.color} rounded-full flex items-center justify-center`}>
                    {category.icon}
                  </div>
                </div>
                <CardTitle>{category.name}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="text-center">
                  {category.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Button 
            onClick={onBack} 
            variant="outline"
            size="lg"
          >
            <ArrowLeft className="mr-2 w-5 h-5" />
            Geri Dön
          </Button>
        </div>
      </div>
    </div>
  );
}

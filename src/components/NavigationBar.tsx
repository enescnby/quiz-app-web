import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { Menu, User, Users, Trophy, Home, LogOut, Shield } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

interface NavigationBarProps {
  userName: string;
  onNavigate: (page: 'gameMode' | 'profile' | 'friends' | 'admin') => void;
  onLogout: () => void;
  isAdmin?: boolean;
}

export function NavigationBar({ userName, onNavigate, onLogout, isAdmin = false }: NavigationBarProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="mx-auto flex w-full items-center justify-between h-16 px-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <Trophy className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="font-semibold">Qio</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2">
            <Button variant="ghost" onClick={() => onNavigate('gameMode')}>
              <Home className="w-4 h-4 mr-2" />
              Ana Sayfa
            </Button>
            <Button variant="ghost" onClick={() => onNavigate('friends')}>
              <Users className="w-4 h-4 mr-2" />
              Arkadaşlar
            </Button>
            <Button variant="ghost" onClick={() => onNavigate('profile')}>
              <User className="w-4 h-4 mr-2" />
              Profil
            </Button>
            {isAdmin && (
              <Button variant="ghost" onClick={() => onNavigate('admin')}>
                <Shield className="w-4 h-4 mr-2" />
                Admin Paneli
              </Button>
            )}
          </div>

          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Menü</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col gap-4 mt-8">
                <div className="flex items-center gap-3 pb-4 border-b">
                  <Avatar>
                    <AvatarImage src="" />
                    <AvatarFallback>{getInitials(userName)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{userName}</p>
                    <p className="text-sm text-muted-foreground">Qio Oyuncusu</p>
                  </div>
                </div>

                <Button variant="ghost" className="justify-start" onClick={() => onNavigate('gameMode')}>
                  <Home className="w-4 h-4 mr-2" />
                  Ana Sayfa
                </Button>
                <Button variant="ghost" className="justify-start" onClick={() => onNavigate('friends')}>
                  <Users className="w-4 h-4 mr-2" />
                  Arkadaşlar
                </Button>
                <Button variant="ghost" className="justify-start" onClick={() => onNavigate('profile')}>
                  <User className="w-4 h-4 mr-2" />
                  Profil
                </Button>
                {isAdmin && (
                  <Button variant="ghost" className="justify-start" onClick={() => onNavigate('admin')}>
                    <Shield className="w-4 h-4 mr-2" />
                    Admin Paneli
                  </Button>
                )}
                <Button variant="ghost" className="justify-start text-destructive" onClick={onLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Çıkış Yap
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          {/* Desktop User Menu */}
          <div className="hidden md:flex items-center gap-2 border-l pl-3">
            <Avatar className="cursor-pointer" onClick={() => onNavigate('profile')}>
              <AvatarImage src="" />
              <AvatarFallback>{getInitials(userName)}</AvatarFallback>
            </Avatar>
            <Button variant="ghost" size="icon" onClick={onLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

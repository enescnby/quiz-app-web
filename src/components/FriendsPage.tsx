import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { UserPlus, Search, Trophy, Target, Users, UserMinus } from "lucide-react";
import { toast } from "sonner@2.0.3";

interface Friend {
  id: string;
  name: string;
  email: string;
  totalQuizzes: number;
  successRate: number;
  status: 'online' | 'offline';
}

interface FriendRequest {
  id: string;
  name: string;
  email: string;
  message: string;
}

export function FriendsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [searchResults, setSearchResults] = useState<Friend[]>([]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleAcceptRequest = (requestId: string) => {
    const request = friendRequests.find(r => r.id === requestId);
    if (request) {
      setFriends([...friends, {
        id: requestId,
        name: request.name,
        email: request.email,
        totalQuizzes: 0,
        successRate: 0,
        status: 'offline'
      }]);
      setFriendRequests(friendRequests.filter(r => r.id !== requestId));
      toast.success(`${request.name} arkadaş listenize eklendi!`);
    }
  };

  const handleRejectRequest = (requestId: string) => {
    setFriendRequests(friendRequests.filter(r => r.id !== requestId));
    toast.error('Arkadaşlık isteği reddedildi');
  };

  const handleRemoveFriend = (friendId: string) => {
    const friend = friends.find(f => f.id === friendId);
    setFriends(friends.filter(f => f.id !== friendId));
    toast.error(`${friend?.name} arkadaş listenizden çıkarıldı`);
  };

  const handleSendFriendRequest = (userId: string) => {
    const user = searchResults.find(u => u.id === userId);
    toast.success(`${user?.name} kişisine arkadaşlık isteği gönderildi!`);
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 pt-20 pb-8 px-4">
      <div className="container max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-primary mb-2">Arkadaşlar</h1>
          <p className="text-muted-foreground">Arkadaşlarınızla yarışın ve birlikte öğrenin</p>
        </div>

        <Tabs defaultValue="friends" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="friends">
              <Users className="w-4 h-4 mr-2" />
              Arkadaşlarım ({friends.length})
            </TabsTrigger>
            <TabsTrigger value="requests">
              <UserPlus className="w-4 h-4 mr-2" />
              İstekler ({friendRequests.length})
            </TabsTrigger>
            <TabsTrigger value="search">
              <Search className="w-4 h-4 mr-2" />
              Arkadaş Bul
            </TabsTrigger>
          </TabsList>

          {/* Arkadaş Listesi */}
          <TabsContent value="friends">
            <Card>
              <CardHeader>
                <CardTitle>Arkadaş Listem</CardTitle>
                <CardDescription>Quiz arkadaşlarınızla istatistikleri</CardDescription>
              </CardHeader>
              <CardContent>
                {friends.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">Henüz arkadaşınız yok</p>
                    <Button disabled>Arkadaş Ekle</Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {friends.map((friend) => (
                      <div key={friend.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <Avatar>
                              <AvatarImage src="" />
                              <AvatarFallback>{getInitials(friend.name)}</AvatarFallback>
                            </Avatar>
                            <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${
                              friend.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                            }`} />
                          </div>
                          <div>
                            <p className="font-medium">{friend.name}</p>
                            <p className="text-sm text-muted-foreground">{friend.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right hidden md:block">
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-1">
                                <Trophy className="w-4 h-4 text-yellow-500" />
                                <span>{friend.totalQuizzes} quiz</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Target className="w-4 h-4 text-green-500" />
                                <span>%{friend.successRate}</span>
                              </div>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveFriend(friend.id)}>
                            <UserMinus className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Arkadaşlık İstekleri */}
          <TabsContent value="requests">
            <Card>
              <CardHeader>
                <CardTitle>Arkadaşlık İstekleri</CardTitle>
                <CardDescription>Gelen arkadaşlık istekleri</CardDescription>
              </CardHeader>
              <CardContent>
                {friendRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <UserPlus className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Yeni arkadaşlık isteğiniz yok</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {friendRequests.map((request) => (
                      <div key={request.id} className="p-4 border rounded-lg">
                        <div className="flex items-start gap-4 mb-3">
                          <Avatar>
                            <AvatarImage src="" />
                            <AvatarFallback>{getInitials(request.name)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium">{request.name}</p>
                            <p className="text-sm text-muted-foreground">{request.email}</p>
                            <p className="text-sm mt-2 text-muted-foreground italic">"{request.message}"</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button className="flex-1" onClick={() => handleAcceptRequest(request.id)}>
                            Kabul Et
                          </Button>
                          <Button variant="outline" className="flex-1" onClick={() => handleRejectRequest(request.id)}>
                            Reddet
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Arkadaş Arama */}
          <TabsContent value="search">
            <Card>
              <CardHeader>
                <CardTitle>Arkadaş Bul</CardTitle>
                <CardDescription>Yeni quiz arkadaşları keşfet</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="İsim veya e-posta ile ara..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {searchResults.length > 0 ? (
                  <div className="space-y-4">
                    {searchResults.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <Avatar>
                            <AvatarImage src="" />
                            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right hidden md:block">
                            <div className="flex items-center gap-4 text-sm">
                              <Badge variant="secondary">
                                <Trophy className="w-3 h-3 mr-1" />
                                {user.totalQuizzes}
                              </Badge>
                              <Badge variant="secondary">
                                <Target className="w-3 h-3 mr-1" />
                                %{user.successRate}
                              </Badge>
                            </div>
                          </div>
                          <Button onClick={() => handleSendFriendRequest(user.id)}>
                            <UserPlus className="w-4 h-4 mr-2" />
                            Ekle
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 text-muted-foreground">
                    Arama sonuçları henüz yüklenmedi.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

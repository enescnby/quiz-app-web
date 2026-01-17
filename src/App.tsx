import { useCallback, useEffect, useRef, useState } from 'react';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { BookOpen } from "lucide-react";
import { QuizPage, Question, QuestionId } from "./components/QuizPage";
import { QuizResult } from "./components/QuizResult";
import { GameModeSelection } from "./components/GameModeSelection";
import { CategorySelection, Category } from "./components/CategorySelection";
import { NavigationBar } from "./components/NavigationBar";
import { ProfilePage } from "./components/ProfilePage";
import { FriendsPage } from "./components/FriendsPage";
import { AdminPanel, ReportedQuestion } from "./components/AdminPanel";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner@2.0.3";
import { useAuth0 } from "@auth0/auth0-react";

type PageState = 'auth' | 'gameMode' | 'category' | 'quiz' | 'result' | 'profile' | 'friends' | 'admin';
type GameMode = 'solo' | 'duel';

type TokenPayload = {
  permissions?: string[];
  sub?: string;
  [key: string]: unknown;
};

type UserStats = {
  userId: string;
  totalScore: number;
  soloScore: number;
  soloCorrectAnswers: number;
  soloWrongAnswers: number;
  duelScore: number;
  duelCorrectAnswers: number;
  duelWrongAnswers: number;
  totalQuizzesPlayed: number;
  totalCorrectAnswers: number;
};

type DuelPlayerState = {
  name?: string;
  score: number;
  correct: number;
  wrong: number;
  answered: number;
};

type DuelSession = {
  code: string;
  status: string;
  questions: Question[];
  players: DuelPlayerState[];
  createdAt?: string;
  updatedAt?: string;
};

const REQUIRED_ADMIN_PERMISSIONS = new Set(['create:quiz', 'create:question']);
const CORRECT_OPTION_KEYS = ['a', 'b', 'c', 'd'] as const;
const CORRECT_OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;
const DEFAULT_FETCH_COUNT = 3;
const DUEL_DEFAULT_QUESTION_COUNT = 10;
const DUEL_HUB_PATH = '/hubs/duel';
const CATEGORY_PAYLOAD_MAP: Record<string, { slug: string; name: string }> = {
  'Genel Kültür': { slug: 'general', name: 'General' },
  'Tarih': { slug: 'history', name: 'History' },
  'Coğrafya': { slug: 'geography', name: 'Geography' },
  'Teknoloji': { slug: 'technology', name: 'Technology' },
  'Spor': { slug: 'sport', name: 'Sport' },
  'Sanat': { slug: 'art', name: 'Art' },
  'Müzik': { slug: 'music', name: 'Music' },
  'Bilim': { slug: 'science', name: 'Science' },
  'Karışık': { slug: 'mixed', name: 'Mixed' },
};

type ApiQuestionRecord = Record<string, unknown>;

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toOptionalNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
};

const toOptionIndex = (value: unknown): number | null => {
  const letter = toTrimmedString(value);
  if (!letter) {
    return null;
  }

  const upper = letter.toUpperCase();
  const idx = CORRECT_OPTION_LETTERS.indexOf(upper as (typeof CORRECT_OPTION_LETTERS)[number]);
  return idx === -1 ? null : idx;
};

const extractOptionTexts = (record: ApiQuestionRecord): string[] => {
  const collected: string[] = [];
  const pushOption = (candidate: unknown) => {
    const optionText = toTrimmedString(candidate);
    if (optionText && !collected.includes(optionText)) {
      collected.push(optionText);
    }
  };

  const optionsField = record['options'];
  if (Array.isArray(optionsField)) {
    for (const item of optionsField) {
      if (typeof item === 'string') {
        pushOption(item);
        continue;
      }
      if (item && typeof item === 'object') {
        const optionRecord = item as ApiQuestionRecord;
        pushOption(optionRecord['text']);
        pushOption(optionRecord['value']);
        pushOption(optionRecord['label']);
        pushOption(optionRecord['optionText']);
      }
    }
  }

  if (collected.length >= 4) {
    return collected.slice(0, 4);
  }

  for (const key of CORRECT_OPTION_LETTERS) {
    pushOption(record[`Option${key}`]);
    pushOption(record[`option${key}`]);
    pushOption(record[`option${key.toLowerCase()}`]);
    pushOption(record[`Choice${key}`]);
    pushOption(record[`choice${key}`]);
  }

  if (collected.length >= 4) {
    return collected.slice(0, 4);
  }

  const alternativeContainers = [
    record['answers'],
    record['Answers'],
    record['choices'],
    record['Choices'],
    record['Options'],
  ];

  for (const container of alternativeContainers) {
    if (!container || typeof container !== 'object' || Array.isArray(container)) {
      continue;
    }
    const containerRecord = container as ApiQuestionRecord;
    for (const key of CORRECT_OPTION_LETTERS) {
      pushOption(containerRecord[key]);
      pushOption(containerRecord[key.toLowerCase()]);
    }
    if (collected.length >= 4) {
      break;
    }
  }

  return collected.slice(0, 4);
};

const extractQuestionCollection = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const record = payload as ApiQuestionRecord;
  const candidateKeys = ['questions', 'questionList', 'items', 'data', 'results', 'content'];

  for (const key of candidateKeys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  for (const value of Object.values(record)) {
    if (Array.isArray(value)) {
      return value;
    }
    if (value && typeof value === 'object') {
      const nested = extractQuestionCollection(value);
      if (nested.length) {
        return nested;
      }
    }
  }

  return [];
};

const deriveCorrectAnswerIndex = (record: ApiQuestionRecord, options: string[]): number => {
  const letterBasedCandidate = record['correctOption'] ?? record['CorrectOption'] ?? record['answerKey'];
  if (typeof letterBasedCandidate === 'string') {
    const normalized = letterBasedCandidate.trim();
    if (normalized.length === 1) {
      const idx = CORRECT_OPTION_LETTERS.indexOf(normalized.toUpperCase() as (typeof CORRECT_OPTION_LETTERS)[number]);
      if (idx !== -1) {
        return idx;
      }
    }

    const textMatchIndex = options.findIndex(option => option.toLowerCase() === normalized.toLowerCase());
    if (textMatchIndex !== -1) {
      return textMatchIndex;
    }
  }

  const numericCandidateRaw = record['correctAnswer'] ?? record['CorrectAnswer'] ?? record['correctIndex'] ?? record['CorrectIndex'] ?? record['answerIndex'];
  const numericCandidate = typeof numericCandidateRaw === 'number'
    ? numericCandidateRaw
    : typeof numericCandidateRaw === 'string'
      ? Number.parseInt(numericCandidateRaw, 10)
      : null;

  if (typeof numericCandidate === 'number' && Number.isFinite(numericCandidate)) {
    if (numericCandidate >= 0 && numericCandidate < options.length) {
      return numericCandidate;
    }
    if (numericCandidate > 0 && numericCandidate <= options.length) {
      return numericCandidate - 1;
    }
  }

  const textCandidate = toTrimmedString(record['correctOptionText'])
    ?? toTrimmedString(record['CorrectOptionText'])
    ?? toTrimmedString(record['correctAnswerText']);
  if (textCandidate) {
    const idx = options.findIndex(option => option.toLowerCase() === textCandidate.toLowerCase());
    if (idx !== -1) {
      return idx;
    }
  }

  return 0;
};

const normalizeFetchedQuestions = (payload: unknown, fallbackCategoryName: string): Question[] => {
  const collection = extractQuestionCollection(payload);
  if (!collection.length) {
    return [];
  }

  return collection
    .map((item, index) => normalizeSingleQuestion(item, fallbackCategoryName, index))
    .filter((question): question is Question => question !== null);
};

const resolveQuestionId = (record: ApiQuestionRecord, index: number): QuestionId => {
  const idCandidate =
    record['id'] ??
    record['questionId'] ??
    record['QuestionId'] ??
    record['questionID'] ??
    record['QuestionID'] ??
    record['testQuestionId'] ??
    record['TestQuestionId'] ??
    record['questionCategoryId'] ??
    record['questionCategoryID'] ??
    record['questionCategory'];

  if (typeof idCandidate === 'number' && Number.isFinite(idCandidate)) {
    return idCandidate;
  }

  if (typeof idCandidate === 'string') {
    const trimmed = idCandidate.trim();
    if (trimmed) {
      const parsed = Number.parseInt(trimmed, 10);
      return Number.isFinite(parsed) ? parsed : trimmed;
    }
  }

  return 10000 + index;
};

const normalizeSingleQuestion = (item: unknown, fallbackCategoryName: string, index: number): Question | null => {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const record = item as ApiQuestionRecord;

  const questionText =
    toTrimmedString(record['text']) ??
    toTrimmedString(record['Text']) ??
    toTrimmedString(record['question']) ??
    toTrimmedString(record['questionText']) ??
    toTrimmedString(record['prompt']);

  if (!questionText) {
    return null;
  }

  const options = extractOptionTexts(record);
  if (options.length < 2) {
    return null;
  }

  const categoryName =
    toTrimmedString(record['categoryName']) ??
    toTrimmedString(record['category']) ??
    fallbackCategoryName;

  const correctIndex = deriveCorrectAnswerIndex(record, options);

  const idValue = resolveQuestionId(record, index);

  return {
    id: idValue,
    question: questionText,
    options,
    correctAnswer: Math.min(Math.max(correctIndex, 0), options.length - 1),
    category: categoryName,
  };
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const normalizeUserStats = (payload: unknown): UserStats | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;

  const userId = toTrimmedString(record['UserId'])
    ?? toTrimmedString(record['userId'])
    ?? '';

  return {
    userId,
    totalScore: toNumber(record['TotalScore'] ?? record['totalScore']),
    soloScore: toNumber(record['SoloScore'] ?? record['soloScore']),
    soloCorrectAnswers: toNumber(record['SoloCorrectAnswers'] ?? record['soloCorrectAnswers']),
    soloWrongAnswers: toNumber(record['SoloWrongAnswers'] ?? record['soloWrongAnswers']),
    duelScore: toNumber(record['DuelScore'] ?? record['duelScore']),
    duelCorrectAnswers: toNumber(record['DuelCorrectAnswers'] ?? record['duelCorrectAnswers']),
    duelWrongAnswers: toNumber(record['DuelWrongAnswers'] ?? record['duelWrongAnswers']),
    totalQuizzesPlayed: toNumber(record['TotalQuizzesPlayed'] ?? record['totalQuizzesPlayed']),
    totalCorrectAnswers: toNumber(record['TotalCorrectAnswers'] ?? record['totalCorrectAnswers']),
  };
};

const clampAnswerIndex = (index: number): number => {
  if (!Number.isFinite(index)) {
    return 0;
  }
  if (index < 0) {
    return 0;
  }
  if (index >= CORRECT_OPTION_LETTERS.length) {
    return CORRECT_OPTION_LETTERS.length - 1;
  }
  return index;
};

const decodeTokenPayload = (token: string): TokenPayload | null => {
  try {
    const [, payload] = token.split('.');
    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (normalized.length % 4)) % 4;
    const padded = normalized.padEnd(normalized.length + padLength, '=');
    const decoded = atob(padded);
    return JSON.parse(decoded) as TokenPayload;
  } catch (error) {
    console.error('Token payload parse error', error);
    return null;
  }
};

const isGuidLike = (value: string | null | undefined): boolean => {
  if (!value) {
    return false;
  }
  const guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
  return guidRegex.test(value.trim());
};

const resolveUserIdClaim = (payload: TokenPayload | null): string | null => {
  if (!payload) {
    return null;
  }

  const claimKeys = [
    'https://qioapp.com/userId',
    'userId',
    'user_id',
    'sub',
  ];

  for (const key of claimKeys) {
    const candidateRaw = payload[key];
    if (typeof candidateRaw !== 'string') {
      continue;
    }
    const candidate = candidateRaw.includes('|') ? candidateRaw.split('|').pop() ?? candidateRaw : candidateRaw;
    if (isGuidLike(candidate)) {
      return candidate.trim();
    }
  }

  return null;
};

const getCategorySlug = (category?: Category): string => {
  const mapped = category ? CATEGORY_PAYLOAD_MAP[category] : undefined;
  return mapped?.slug ?? CATEGORY_PAYLOAD_MAP['Genel Kültür'].slug;
};

const normalizeDuelPlayers = (payload: unknown): DuelPlayerState[] => {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const record = item as ApiQuestionRecord;
      const name =
        toTrimmedString(record['name']) ??
        toTrimmedString(record['username']) ??
        toTrimmedString(record['userName']) ??
        toTrimmedString(record['displayName']) ??
        toTrimmedString(record['playerName']) ??
        `Oyuncu ${index + 1}`;

      return {
        name,
        score: toNumber(record['score'] ?? record['points'] ?? record['totalScore']),
        correct: toNumber(record['correct'] ?? record['correctCount'] ?? record['correctAnswers']),
        wrong: toNumber(record['wrong'] ?? record['wrongCount'] ?? record['wrongAnswers']),
        answered: toNumber(record['answered'] ?? record['answeredCount']),
      };
    })
    .filter((player): player is DuelPlayerState => player !== null);
};

const normalizeDuelSession = (payload: unknown, fallbackCategory?: Category): DuelSession | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as ApiQuestionRecord;
  const code = toTrimmedString(record['code'] ?? record['sessionCode'] ?? record['Code']);
  if (!code) {
    return null;
  }

  const status = toTrimmedString(record['status'] ?? record['Status']) ?? 'waiting';

  const questionsRaw = Array.isArray(record['questions'])
    ? record['questions']
    : Array.isArray(record['Questions'])
      ? record['Questions']
      : extractQuestionCollection(record['questions'] ?? record['Questions']);

  const normalizedQuestions = (questionsRaw ?? [])
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const questionRecord = item as ApiQuestionRecord;
      const questionText =
        toTrimmedString(questionRecord['text']) ??
        toTrimmedString(questionRecord['question']) ??
        toTrimmedString(questionRecord['questionText']) ??
        `Soru ${index + 1}`;

      const options = extractOptionTexts(questionRecord);
      if (options.length < 2) {
        return null;
      }

      const idCandidate =
        questionRecord['id'] ??
        questionRecord['questionId'] ??
        questionRecord['QuestionId'] ??
        questionRecord['QuestionID'];

      const idValue = resolveQuestionId(questionRecord, index);

      return {
        id: idValue,
        question: questionText,
        options,
        correctAnswer: 0,
        category: fallbackCategory ?? 'Düello',
      };
    })
    .filter((question): question is Question => question !== null);

  const playersRaw =
    Array.isArray(record['players']) ? record['players']
    : Array.isArray(record['Players']) ? record['Players']
    : [];
  const players = normalizeDuelPlayers(playersRaw);

  const createdAt =
    toTrimmedString(record['createdAt']) ??
    toTrimmedString(record['CreatedAt']) ??
    toTrimmedString(record['createdOn']);

  const updatedAt =
    toTrimmedString(record['updatedAt']) ??
    toTrimmedString(record['UpdatedAt']) ??
    toTrimmedString(record['updatedOn']);

  return {
    code,
    status,
    questions: normalizedQuestions,
    players,
    createdAt: createdAt ?? undefined,
    updatedAt: updatedAt ?? undefined,
  };
};

export default function App() {
  const { isLoading, isAuthenticated, user, loginWithRedirect, logout, getAccessTokenSilently } = useAuth0();
  const [currentPage, setCurrentPage] = useState<PageState>('auth');
  const [quizScore, setQuizScore] = useState({ score: 0, total: 0 });
  const [selectedGameMode, setSelectedGameMode] = useState<GameMode>('solo');
  const [selectedCategory, setSelectedCategory] = useState<Category | undefined>();
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [fetchedQuestions, setFetchedQuestions] = useState<Question[]>([]);
  const [isFetchingQuestions, setIsFetchingQuestions] = useState(false);
  const [fetchQuestionsError, setFetchQuestionsError] = useState<string | null>(null);
  const [nextQuestionId, setNextQuestionId] = useState(1000); // Custom sorular 1000'den başlasın
  const [hasCreateQuizPermission, setHasCreateQuizPermission] = useState(false);
  const [tokenUsername, setTokenUsername] = useState('');
  const [profileStats, setProfileStats] = useState<UserStats | null>(null);
  const [isFetchingProfileStats, setIsFetchingProfileStats] = useState(false);
  const [profileStatsError, setProfileStatsError] = useState<string | null>(null);
  const [duelSession, setDuelSession] = useState<DuelSession | null>(null);
  const [isLoadingDuelSession, setIsLoadingDuelSession] = useState(false);
  const [duelError, setDuelError] = useState<string | null>(null);
  const [duelScores, setDuelScores] = useState<{ player: number; opponent: number }>({ player: 0, opponent: 0 });
  const duelHubRef = useRef<HubConnection | null>(null);
  const duelSessionCodeRef = useRef<string | null>(null);
  const duelUserIdRef = useRef<string | null>(null);

  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  const resetDuelState = useCallback(() => {
    setDuelSession(null);
    setDuelError(null);
    setIsLoadingDuelSession(false);
    setDuelScores({ player: 0, opponent: 0 });
    duelSessionCodeRef.current = null;
    if (duelHubRef.current) {
      duelHubRef.current.stop().catch((error) => console.error('Duel hub stop failed', error));
      duelHubRef.current = null;
    }
  }, []);

  const resolveDuelScoresFromPlayers = useCallback((players: DuelPlayerState[]) => {
    const player = players[0]?.score ?? 0;
    const opponent = players[1]?.score ?? 0;
    setDuelScores({
      player: toNumber(player),
      opponent: toNumber(opponent),
    });
  }, []);

  const getApiBaseUrl = () => {
    const baseUrlEnv = import.meta.env.VITE_API_BASE_URL ?? 'https://localhost:5001';
    return baseUrlEnv.endsWith('/') ? baseUrlEnv.slice(0, -1) : baseUrlEnv;
  };

  const getDuelHubUrl = () => `${getApiBaseUrl()}${DUEL_HUB_PATH}`;

  const applyDuelSessionUpdate = useCallback((payload: unknown, fallbackCategory?: Category) => {
    const normalized = normalizeDuelSession(payload, fallbackCategory);
    if (!normalized) {
      console.warn('[Qio] Invalid duel session payload', payload);
      return null;
    }

    setDuelSession((prev) => {
      const mergedQuestions = normalized.questions.length
        ? normalized.questions
        : prev?.questions ?? [];
      const mergedPlayers = normalized.players.length
        ? normalized.players
        : prev?.players ?? [];

      const nextSession: DuelSession = {
        ...normalized,
        questions: mergedQuestions,
        players: mergedPlayers,
      };

      resolveDuelScoresFromPlayers(nextSession.players);
      duelSessionCodeRef.current = nextSession.code;
      return nextSession;
    });

    return normalized;
  }, [resolveDuelScoresFromPlayers]);

  const handleSessionUpdatedEvent = useCallback((payload: unknown) => {
    const normalized = applyDuelSessionUpdate(payload, selectedCategory);
    if (normalized) {
      setDuelError(null);
    }
    setIsLoadingDuelSession(false);
  }, [applyDuelSessionUpdate, selectedCategory]);

  const handleAnswerResultEvent = useCallback((payload: unknown) => {
    if (!payload || typeof payload !== 'object') {
      return;
    }

    const record = payload as ApiQuestionRecord;
    const playerScore = toOptionalNumber(record['playerScore'] ?? record['PlayerScore']);
    const opponentScore = toOptionalNumber(record['opponentScore'] ?? record['OpponentScore']);
    const status = toTrimmedString(record['status'] ?? record['Status']);
    const correctOption = toTrimmedString(record['correctOption'] ?? record['CorrectOption']);
    const isCompletedRaw = record['isCompleted'] ?? record['IsCompleted'];
    const isCompleted = typeof isCompletedRaw === 'boolean'
      ? isCompletedRaw
      : typeof isCompletedRaw === 'string'
        ? isCompletedRaw.toLowerCase() === 'true'
        : false;

    if (playerScore !== null || opponentScore !== null) {
      setDuelScores((prev) => ({
        player: playerScore ?? prev.player,
        opponent: opponentScore ?? prev.opponent,
      }));
    }

    if (status) {
      setDuelSession((prev) => prev ? { ...prev, status } : prev);
    } else if (isCompleted) {
      setDuelSession((prev) => prev ? { ...prev, status: 'completed' } : prev);
    }

    if (correctOption) {
      console.info('[Qio] AnswerResult', {
        correctOption,
        playerScore,
        opponentScore,
        status,
        isCompleted,
      });
    }
  }, []);

  const attachDuelHubListeners = useCallback((connection: HubConnection) => {
    connection.off('SessionUpdated');
    connection.off('AnswerResult');

    connection.on('SessionUpdated', handleSessionUpdatedEvent);
    connection.on('AnswerResult', handleAnswerResultEvent);
  }, [handleAnswerResultEvent, handleSessionUpdatedEvent]);

  const ensureDuelHubConnection = useCallback(async () => {
    if (!audience) {
      throw new Error('API audience yapılandırması eksik.');
    }

    const existing = duelHubRef.current;
    if (existing) {
      attachDuelHubListeners(existing);
      if (existing.state === HubConnectionState.Disconnected) {
        await existing.start();
      }
      if (existing.state !== HubConnectionState.Connected) {
        throw new Error('Düello bağlantısı yeniden kurulamadı, lütfen tekrar deneyin.');
      }
      return existing;
    }

    const hubUrl = getDuelHubUrl();
    const connection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () =>
          getAccessTokenSilently({
            authorizationParams: {
              audience,
            },
          }),
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    connection.onclose((error) => {
      if (error) {
        console.error('Duel hub connection closed unexpectedly', error);
      }
    });

    connection.onreconnected(() => {
      const activeCode = duelSessionCodeRef.current;
      if (activeCode) {
        connection.invoke('JoinSession', activeCode)
          .then((payload) => applyDuelSessionUpdate(payload, selectedCategory))
          .catch((error) => {
            console.error('Failed to re-sync duel session after reconnect', error);
          });
      }
    });

    attachDuelHubListeners(connection);

    await connection.start();
    if (connection.state !== HubConnectionState.Connected) {
      throw new Error('Düello bağlantısı başlatılamadı.');
    }
    duelHubRef.current = connection;
    return connection;
  }, [applyDuelSessionUpdate, audience, attachDuelHubListeners, getAccessTokenSilently, getDuelHubUrl, selectedCategory]);

  const userEmail = user?.email ?? '';
  const userNickname = user?.nickname ?? '';
  const displayName =
    tokenUsername ||
    userNickname ||
    user?.name ||
    (userEmail ? userEmail.split('@')[0] : '') ||
    'Qio Kullanıcısı';
  const isAdmin = hasCreateQuizPermission;

  const prevDuelPlayerCountRef = useRef<number>(0);

  const handleAuthLogout = () => {
    setFetchedQuestions([]);
    setFetchQuestionsError(null);
    setSelectedCategory(undefined);
    setProfileStats(null);
    setProfileStatsError(null);
    setIsFetchingProfileStats(false);
    resetDuelState();
    setCurrentPage('auth');
    logout({ logoutParams: { returnTo: window.location.origin } });
  };

  useEffect(() => {
    if (isAuthenticated && currentPage === 'auth') {
      setCurrentPage('gameMode');
    }
    if (!isAuthenticated && currentPage !== 'auth') {
      setCurrentPage('auth');
    }
  }, [isAuthenticated, currentPage]);

  useEffect(() => {
    const fetchPermissions = async () => {
    if (!isAuthenticated || !audience) {
      setHasCreateQuizPermission(false);
      setTokenUsername('');
      duelUserIdRef.current = null;
      return;
    }

    try {
      const token = await getAccessTokenSilently({
          authorizationParams: {
            audience,
          },
        });

      const payload = decodeTokenPayload(token);
      const permissions = Array.isArray(payload?.permissions) ? payload?.permissions : [];
      setHasCreateQuizPermission(permissions.some(permission => REQUIRED_ADMIN_PERMISSIONS.has(permission)));

      const resolvedUserId = resolveUserIdClaim(payload);
      duelUserIdRef.current = resolvedUserId;

      const usernameClaimRaw = payload?.['https://qioapp.com/username'];
      const usernameClaim = typeof usernameClaimRaw === 'string' ? usernameClaimRaw.trim() : '';

      setTokenUsername(usernameClaim || '');
      } catch (error) {
        console.error('Failed to retrieve access token', error);
        setHasCreateQuizPermission(false);
        setTokenUsername('');
      }
    };

    fetchPermissions();
  }, [isAuthenticated, getAccessTokenSilently, audience]);

  useEffect(() => {
    return () => {
      if (duelHubRef.current) {
        duelHubRef.current.stop().catch((error) => console.error('Duel hub cleanup failed', error));
        duelHubRef.current = null;
      }
    };
  }, []);

  const handleNavigate = (page: 'gameMode' | 'profile' | 'friends' | 'admin') => {
    if (page === 'admin' && !isAdmin) {
      return;
    }

    if (page === 'gameMode') {
      handleBackToHome();
      return;
    }

    setCurrentPage(page);
  };

  const handleAddQuestion = (question: Omit<Question, 'id'>) => {
    const newQuestion: Question = {
      ...question,
      id: nextQuestionId
    };
    setQuizQuestions((prev) => [...prev, newQuestion]);
    setNextQuestionId(nextQuestionId + 1);
  };

  const handleDeleteQuestion = (id: QuestionId) => {
    setQuizQuestions((prev) => prev.filter(q => q.id !== id));
  };

  const createDuelSessionForCategory = useCallback(async (category: Category) => {
    if (!audience) {
      throw new Error('API audience yapılandırması eksik.');
    }

    setIsLoadingDuelSession(true);
    setDuelError(null);

    try {
      const connection = await ensureDuelHubConnection();
      const body = {
        categorySlug: getCategorySlug(category),
        questionCount: DUEL_DEFAULT_QUESTION_COUNT,
        userId: duelUserIdRef.current ?? undefined,
      };

      console.info('[Qio] Create duel session (SignalR)', {
        body,
        hubUrl: getDuelHubUrl(),
      });

      const payload = await connection.invoke('CreateSession', body);
      const normalized = applyDuelSessionUpdate(payload, category);
      if (!normalized) {
        throw new Error('Düello oturumu oluşturulamadı.');
      }

      return normalized;
    } catch (error) {
      console.error('Düello oturumu oluşturulamadı', error);
      const message = error instanceof Error ? error.message : 'Düello oturumu oluşturulamadı.';
      setDuelError(message);
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setIsLoadingDuelSession(false);
    }
  }, [applyDuelSessionUpdate, audience, ensureDuelHubConnection]);

  const joinDuelSessionWithCode = useCallback(async (code: string, category?: Category) => {
    if (!audience) {
      throw new Error('API audience yapılandırması eksik.');
    }

    const trimmedCode = code.trim();
    if (!trimmedCode) {
      throw new Error('Geçerli bir düello kodu girin.');
    }

    setIsLoadingDuelSession(true);
    setDuelError(null);

    try {
      const connection = await ensureDuelHubConnection();

      console.info('[Qio] Join duel session (SignalR)', {
        hubUrl: getDuelHubUrl(),
        code: trimmedCode,
      });

      const payload = await connection.invoke('JoinSession', trimmedCode);
      const normalized = applyDuelSessionUpdate(payload, category);
      if (!normalized) {
        throw new Error('Düello oturumu yanıtı geçersiz.');
      }

      return normalized;
    } catch (error) {
      console.error('Düello oturumuna katılınamadı', error);
      const message = error instanceof Error ? error.message : 'Düello oturumuna katılınamadı.';
      setDuelError(message);
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setIsLoadingDuelSession(false);
    }
  }, [applyDuelSessionUpdate, audience, ensureDuelHubConnection]);

  const refreshDuelSession = useCallback(async (code: string, category?: Category) => {
    if (!audience) {
      throw new Error('API audience yapılandırması eksik.');
    }

    const trimmedCode = code.trim();
    if (!trimmedCode) {
      throw new Error('Düello kodu bulunamadı.');
    }

    setIsLoadingDuelSession(true);
    setDuelError(null);

    try {
      const connection = await ensureDuelHubConnection();

      console.info('[Qio] Refresh duel session (SignalR)', {
        hubUrl: getDuelHubUrl(),
        code: trimmedCode,
      });

      const payload = await connection.invoke('GetSession', trimmedCode);
      const normalized = applyDuelSessionUpdate(payload, category);
      if (!normalized) {
        throw new Error('Düello oturumu alınamadı.');
      }

      return normalized;
    } catch (error) {
      console.error('Düello oturumu alınamadı', error);
      const message = error instanceof Error ? error.message : 'Düello oturumu alınamadı.';
      setDuelError(message);
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setIsLoadingDuelSession(false);
    }
  }, [applyDuelSessionUpdate, audience, ensureDuelHubConnection]);

  const submitDuelAnswer = useCallback(async (questionId: QuestionId, answerIndex: number) => {
    if (!audience) {
      throw new Error('API audience yapılandırması eksik.');
    }

    if (!duelSession?.code) {
      throw new Error('Aktif bir düello oturumu bulunamadı.');
    }

    const boundedIndex = clampAnswerIndex(answerIndex);
    const selectedOption = CORRECT_OPTION_KEYS[boundedIndex];

    try {
      const connection = await ensureDuelHubConnection();

      console.info('[Qio] Submit duel answer (SignalR)', {
        hubUrl: getDuelHubUrl(),
        code: duelSession.code,
        questionId,
        selectedOption,
      });

      const payloadRecord = await connection.invoke<ApiQuestionRecord>('SubmitAnswer', duelSession.code, {
        questionId,
        selectedOption,
        userId: duelUserIdRef.current ?? undefined,
      });

      const isCorrectRaw = payloadRecord['isCorrect'] ?? payloadRecord['IsCorrect'];
      const correctOptionRaw = toTrimmedString(payloadRecord['correctOption']) ?? toTrimmedString(payloadRecord['CorrectOption']);
      const playerScoreRaw = payloadRecord['playerScore'] ?? payloadRecord['PlayerScore'];
      const opponentScoreRaw = payloadRecord['opponentScore'] ?? payloadRecord['OpponentScore'];
      const statusRaw = payloadRecord['status'] ?? payloadRecord['duelStatus'] ?? payloadRecord['Status'];
      const isCompletedRaw = payloadRecord['isCompleted'] ?? payloadRecord['IsCompleted'];

      const playerScore = toNumber(playerScoreRaw);
      const opponentScore = toNumber(opponentScoreRaw);

      setDuelScores({
        player: playerScore,
        opponent: opponentScore,
      });

      const status = toTrimmedString(statusRaw);
      if (status) {
        setDuelSession((prev) => prev ? { ...prev, status } : prev);
      }

      const isCompleted = typeof isCompletedRaw === 'boolean'
        ? isCompletedRaw
        : typeof isCompletedRaw === 'string'
          ? isCompletedRaw.toLowerCase() === 'true'
          : false;

      return {
        isCorrect: typeof isCorrectRaw === 'boolean' ? isCorrectRaw : String(isCorrectRaw).toLowerCase() === 'true',
        correctOption: correctOptionRaw?.toUpperCase() ?? null,
        playerScore,
        opponentScore,
        status: status ?? null,
        isCompleted,
      };
    } catch (error) {
      console.error('Düello cevabı gönderilemedi', error);
      throw error instanceof Error ? error : new Error('Düello cevabı gönderilemedi.');
    }
  }, [audience, duelSession, ensureDuelHubConnection]);

  const fetchQuestionsForCategory = useCallback(async (category: Category) => {
    setIsFetchingQuestions(true);
    setFetchQuestionsError(null);
    setFetchedQuestions([]);

    if (!audience) {
      const audienceError = new Error('API audience yapılandırması eksik.');
      setFetchQuestionsError(audienceError.message);
      throw audienceError;
    }

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience,
        },
      });

      const baseUrlEnv = import.meta.env.VITE_API_BASE_URL ?? 'https://localhost:5001';
      const apiBaseUrl = baseUrlEnv.endsWith('/') ? baseUrlEnv.slice(0, -1) : baseUrlEnv;
      const categoryPayload = CATEGORY_PAYLOAD_MAP[category] ?? CATEGORY_PAYLOAD_MAP['Genel Kültür'];
      const endpoint = `${apiBaseUrl}/api/question/category/${categoryPayload.slug}?count=${DEFAULT_FETCH_COUNT}`;

      console.info('[Qio] Fetching category questions', {
        endpoint,
        categorySlug: categoryPayload.slug,
        requestedCount: DEFAULT_FETCH_COUNT,
      });

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Sorular alınamadı.');
      }

      const payload = await response.json();
      const normalized = normalizeFetchedQuestions(payload, category);

      if (!normalized.length) {
        throw new Error('Bu kategori için soru bulunamadı.');
      }

      console.info('[Qio] Received category questions', {
        category: categoryPayload.slug,
        count: normalized.length,
        questionIds: normalized.map((question) => question.id),
      });

      setFetchedQuestions(normalized);
      return normalized;
    } catch (error) {
      console.error('Kategori soruları alınırken hata oluştu', error);
      const message = error instanceof Error ? error.message : 'Sorular alınamadı, lütfen tekrar deneyin.';
      setFetchedQuestions([]);
      setFetchQuestionsError(message);
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setIsFetchingQuestions(false);
    }
  }, [audience, getAccessTokenSilently]);

  const fetchProfileStats = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }

    if (!audience) {
      setProfileStatsError('API audience yapılandırması eksik.');
      setProfileStats(null);
      return;
    }

    setIsFetchingProfileStats(true);
    setProfileStatsError(null);

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience,
        },
      });

      const baseUrlEnv = import.meta.env.VITE_API_BASE_URL ?? 'https://localhost:5001';
      const apiBaseUrl = baseUrlEnv.endsWith('/') ? baseUrlEnv.slice(0, -1) : baseUrlEnv;
      const endpoint = `${apiBaseUrl}/api/user/stats`;

      console.info('[Qio] Fetching user stats', { endpoint });

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Kullanıcı istatistikleri alınamadı.');
      }

      const payloadText = await response.text();
      console.info('[Qio] User stats response raw', {
        status: response.status,
        body: payloadText,
      });

      let payload: unknown = {};
      if (payloadText) {
        try {
          payload = JSON.parse(payloadText);
        } catch (parseError) {
          console.error('Kullanıcı istatistikleri JSON olarak ayrıştırılamadı', parseError);
          throw new Error('Sunucudan geçersiz istatistik verisi alındı.');
        }
      }

      const normalized = normalizeUserStats(payload);
      if (!normalized) {
        throw new Error('Kullanıcı istatistikleri eksik veya geçersiz.');
      }

      setProfileStats(normalized);
    } catch (error) {
      console.error('Kullanıcı istatistikleri alınırken hata oluştu', error);
      const message = error instanceof Error ? error.message : 'Kullanıcı istatistikleri alınamadı.';
      setProfileStats(null);
      setProfileStatsError(message);
    } finally {
      setIsFetchingProfileStats(false);
    }
  }, [isAuthenticated, audience, getAccessTokenSilently]);

  useEffect(() => {
    if (!isAuthenticated || currentPage !== 'profile') {
      return;
    }

    fetchProfileStats();
  }, [isAuthenticated, currentPage, fetchProfileStats]);

  useEffect(() => {
    const playerCount = duelSession?.players?.length ?? 0;
    const previousCount = prevDuelPlayerCountRef.current;
    prevDuelPlayerCountRef.current = playerCount;

    if (
      selectedGameMode === 'duel' &&
      currentPage === 'quiz' &&
      previousCount >= 2 &&
      playerCount < 2
    ) {
      toast.error('Rakibin odadan ayrıldı. Oturum kapatıldı.');
      resetDuelState();
      setCurrentPage('category');
    }
  }, [currentPage, duelSession?.players?.length, resetDuelState, selectedGameMode]);

  const submitGuessForQuestion = useCallback(async (questionId: QuestionId, answerIndex: number) => {
    if (!audience) {
      throw new Error('API audience yapılandırması eksik.');
    }

    const boundedIndex = clampAnswerIndex(answerIndex);
    const optionLetter = CORRECT_OPTION_LETTERS[boundedIndex];
    const numericId = typeof questionId === 'string' ? Number.parseInt(questionId, 10) : questionId;
    if (!Number.isFinite(numericId)) {
      throw new Error('Geçersiz soru kimliği.');
    }

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience,
        },
      });

      const baseUrlEnv = import.meta.env.VITE_API_BASE_URL ?? 'https://localhost:5001';
      const apiBaseUrl = baseUrlEnv.endsWith('/') ? baseUrlEnv.slice(0, -1) : baseUrlEnv;
      const endpoint = `${apiBaseUrl}/api/question/guess/${numericId}/${optionLetter.toLowerCase()}`;

      console.info('[Qio] Submit guess', {
        questionId,
        optionLetter: optionLetter.toLowerCase(),
      });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Cevap değerlendirilirken bir hata oluştu.');
      }

      const payloadText = await response.text();
      console.info('[Qio] Guess response raw', {
        status: response.status,
        body: payloadText,
      });

      let payload: unknown = {};
      if (payloadText) {
        try {
          payload = JSON.parse(payloadText);
        } catch (parseError) {
          console.error('Cevap JSON olarak ayrıştırılamadı', parseError);
          throw new Error('Sunucudan geçersiz cevap alındı.');
        }
      }
      const payloadRecord = payload as ApiQuestionRecord;
      const isCorrectRaw = payloadRecord['isCorrect'] ?? payloadRecord['IsCorrect'];
      const correctOptionRaw = toTrimmedString(payloadRecord['correctOption'])
        ?? toTrimmedString(payloadRecord['CorrectOption']);

      return {
        isCorrect: typeof isCorrectRaw === 'boolean' ? isCorrectRaw : String(isCorrectRaw).toLowerCase() === 'true',
        correctOption: correctOptionRaw?.toUpperCase() ?? null,
      };
    } catch (error) {
      console.error('Cevap değerlendirilirken hata oluştu', error);
      throw error instanceof Error ? error : new Error('Cevap değerlendirilirken bir hata oluştu.');
    }
  }, [audience, getAccessTokenSilently]);

  const reportQuestion = useCallback(async (questionId: QuestionId, reason: string) => {
    if (!audience) {
      throw new Error('API audience yapılandırması eksik.');
    }

    const numericId = typeof questionId === 'string' ? Number.parseInt(questionId, 10) : questionId;
    if (!Number.isFinite(numericId)) {
      throw new Error('Geçersiz soru kimliği.');
    }

    const token = await getAccessTokenSilently({
      authorizationParams: {
        audience,
      },
    });

    const baseUrlEnv = import.meta.env.VITE_API_BASE_URL ?? 'https://localhost:5001';
    const apiBaseUrl = baseUrlEnv.endsWith('/') ? baseUrlEnv.slice(0, -1) : baseUrlEnv;
    const endpoint = `${apiBaseUrl}/api/question/${numericId}/report`;

    console.info('[Qio] Report question', {
      questionId,
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || 'Soru bildirimi gönderilemedi.');
    }
  }, [audience, getAccessTokenSilently]);

  const fetchReportedQuestions = useCallback(async (): Promise<ReportedQuestion[]> => {
    if (!audience) {
      throw new Error('API audience yapılandırması eksik.');
    }

    const token = await getAccessTokenSilently({
      authorizationParams: {
        audience,
      },
    });

    const baseUrlEnv = import.meta.env.VITE_API_BASE_URL ?? 'https://localhost:5001';
    const apiBaseUrl = baseUrlEnv.endsWith('/') ? baseUrlEnv.slice(0, -1) : baseUrlEnv;
    const endpoint = `${apiBaseUrl}/api/question/admin/reports`;

    console.info('[Qio] Fetch reported questions');

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || 'Raporlanan sorular alınamadı.');
    }

    const payloadText = await response.text();
    if (!payloadText) {
      return [];
    }

    let payload: unknown;
    try {
      payload = JSON.parse(payloadText);
    } catch (parseError) {
      console.error('Raporlanan sorular JSON olarak ayrıştırılamadı', parseError);
      throw new Error('Sunucudan geçersiz rapor verisi alındı.');
    }

    const resolveArray = (value: unknown): unknown[] => {
      if (Array.isArray(value)) {
        return value;
      }

      if (!value || typeof value !== 'object') {
        return [];
      }

      for (const entry of Object.values(value)) {
        if (Array.isArray(entry)) {
          return entry;
        }
        if (entry && typeof entry === 'object') {
          const nested = resolveArray(entry);
          if (nested.length > 0) {
            return nested;
          }
        }
      }

      return [];
    };

    const records = resolveArray(payload);

    return records
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
      .map((record, index) => {
        const idRaw =
          record['questionReportId'] ??
          record['reportId'] ??
          record['reportID'] ??
          record['ReportId'] ??
          record['id'];

        const questionIdRaw =
          record['testQuestionId'] ??
          record['questionId'] ??
          record['QuestionId'] ??
          record['QuestionID'] ??
          record['question_id'];

        const questionTextRaw =
          record['questionText'] ??
          record['QuestionText'] ??
          record['question'] ??
          record['Question'] ??
          record['text'];

        const reasonRaw =
          record['reason'] ??
          record['Reason'] ??
          record['reportReason'] ??
          record['description'] ??
          record['Description'];

        const reporterIdRaw =
          record['reporterUserId'] ??
          record['ReporterUserId'] ??
          record['reporterId'] ??
          record['ReporterId'];

        const reporterUsernameRaw =
          record['reporterUsername'] ??
          record['ReporterUsername'] ??
          record['reportedBy'] ??
          record['ReportedBy'] ??
          record['reporter'] ??
          record['user'] ??
          record['User'];

        const createdAtRaw =
          record['reportedAt'] ??
          record['ReportedAt'] ??
          record['createdAt'] ??
          record['CreatedAt'] ??
          record['createdOn'] ??
          record['CreatedOn'] ??
          record['timestamp'] ??
          record['Timestamp'];

        const statusRaw = record['status'] ?? record['Status'];
        const categoryNameRaw = record['categoryName'] ?? record['CategoryName'] ?? record['category'] ?? record['Category'];
        const categorySlugRaw = record['categorySlug'] ?? record['CategorySlug'];

        const optionLetters = ['A', 'B', 'C', 'D'] as const;
        const options = optionLetters.map((letter) => {
          const lower = letter.toLowerCase();
          return (
            toTrimmedString(record[`option${letter}`]) ??
            toTrimmedString(record[`Option${letter}`]) ??
            toTrimmedString(record[`option${lower}`]) ??
            toTrimmedString(record[`Option${lower}`]) ??
            ''
          );
        });

        const correctOptionIndex =
          toOptionIndex(record['correctOption']) ??
          toOptionIndex(record['CorrectOption']);

        const identifier = toOptionalNumber(idRaw) ?? index + 1;
        const questionIdentifier = toOptionalNumber(questionIdRaw);
        const questionText = toTrimmedString(questionTextRaw) ?? 'Soru metni bulunamadı.';
        const reason = toTrimmedString(reasonRaw) ?? 'Sebep belirtilmemiş.';
        const reporterId = toTrimmedString(reporterIdRaw);
        const reporterUsername = toTrimmedString(reporterUsernameRaw);
        const reportedAt = toTrimmedString(createdAtRaw);
        const status = toTrimmedString(statusRaw);
        const categoryName = toTrimmedString(categoryNameRaw);
        const categorySlug = toTrimmedString(categorySlugRaw);

        return {
          id: identifier,
          questionId: questionIdentifier ?? undefined,
          questionText,
          categoryName: categoryName ?? undefined,
          categorySlug: categorySlug ?? undefined,
          options,
          correctAnswerIndex: typeof correctOptionIndex === 'number' ? correctOptionIndex : null,
          reason,
          reporterId: reporterId ?? undefined,
          reporterUsername: reporterUsername ?? undefined,
          reportedAt: reportedAt ?? undefined,
          status: status ?? undefined,
        };
      });
  }, [audience, getAccessTokenSilently]);

  const handleGameModeSelect = (mode: GameMode) => {
    setSelectedGameMode(mode);
    setSelectedCategory(undefined);
    setFetchedQuestions([]);
    setFetchQuestionsError(null);
    resetDuelState();
    setCurrentPage('category');
  };

  const handleCategorySelect = (category: Category) => {
    setSelectedCategory(category);
    setCurrentPage('quiz');

    if (selectedGameMode === 'duel') {
      resetDuelState();
      return;
    }

    fetchQuestionsForCategory(category).catch((error) => {
      const message = error instanceof Error ? error.message : 'Sorular alınamadı, lütfen tekrar deneyin.';
      toast.error(message);
    });
  };

  const handleRetryFetchQuestions = useCallback(() => {
    if (!selectedCategory) {
      return;
    }

    fetchQuestionsForCategory(selectedCategory).catch((error) => {
      const message = error instanceof Error ? error.message : 'Sorular alınamadı, lütfen tekrar deneyin.';
      toast.error(message);
    });
  }, [selectedCategory, fetchQuestionsForCategory]);

  const handleQuizComplete = (score: number, total: number) => {
    setQuizScore({ score, total });
    setCurrentPage('result');
  };

  const handleRestartQuiz = () => {
    setFetchedQuestions([]);
    setFetchQuestionsError(null);
    setSelectedCategory(undefined);
    resetDuelState();
    setCurrentPage('category');
  };

  const handleBackToHome = () => {
    setFetchedQuestions([]);
    setFetchQuestionsError(null);
    setSelectedCategory(undefined);
    resetDuelState();
    setCurrentPage('gameMode');
  };

  const handleSubmitQuestionsToServer = async (questionsToSubmit: Question[]) => {
    if (questionsToSubmit.length === 0) {
      throw new Error('Gönderilecek soru bulunmuyor.');
    }

    if (!audience) {
      throw new Error('API audience yapılandırması eksik.');
    }

    const token = await getAccessTokenSilently({
      authorizationParams: {
        audience,
      },
    });

    const baseUrlEnv = import.meta.env.VITE_API_BASE_URL ?? 'https://localhost:5001';
    if (!baseUrlEnv) {
      throw new Error('API temel adresi bulunamadı.');
    }

    const apiBaseUrl = baseUrlEnv.endsWith('/') ? baseUrlEnv.slice(0, -1) : baseUrlEnv;
    const endpoint = `${apiBaseUrl}/api/question/admin/createTestQuestions`;

    const requestBody = questionsToSubmit.map((question) => {
      if (question.options.length < 4) {
        throw new Error('Her soru için dört seçenek girilmelidir.');
      }

      const correctKey = CORRECT_OPTION_KEYS[question.correctAnswer];
      if (!correctKey) {
        throw new Error('Doğru cevap seçimi geçersiz.');
      }

      const mappedCategory = CATEGORY_PAYLOAD_MAP[question.category] ?? CATEGORY_PAYLOAD_MAP['Genel Kültür'];

      return {
        CategorySlug: mappedCategory.slug,
        CategoryName: mappedCategory.name,
        Text: question.question,
        OptionA: question.options[0],
        OptionB: question.options[1],
        OptionC: question.options[2],
        OptionD: question.options[3],
        CorrectOption: correctKey.toUpperCase(),
      };
    });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || 'Sorular gönderilirken bir hata oluştu.');
    }

    setQuizQuestions([]);
    setNextQuestionId(1000);
  };

  // Admin panelini göster
  if (currentPage === 'admin') {
    if (!isAdmin) {
      return (
        <>
          <NavigationBar userName={displayName} onNavigate={handleNavigate} onLogout={handleAuthLogout} isAdmin={isAdmin} />
          <div className="pt-24 px-4">
            <Card className="max-w-xl mx-auto">
              <CardHeader>
                <CardTitle>Yetkisiz Erişim</CardTitle>
                <CardDescription>Bu alana erişmek için gerekli izniniz bulunmuyor.</CardDescription>
              </CardHeader>
            </Card>
          </div>
          <Toaster />
        </>
      );
    }
    return (
      <>
        <NavigationBar userName={displayName} onNavigate={handleNavigate} onLogout={handleAuthLogout} isAdmin={isAdmin} />
        <AdminPanel 
          onAddQuestion={handleAddQuestion}
          questions={quizQuestions}
          onDeleteQuestion={handleDeleteQuestion}
          onSubmitAll={handleSubmitQuestionsToServer}
          fetchReportedQuestions={fetchReportedQuestions}
        />
        <Toaster />
      </>
    );
  }

  // Profil sayfasını göster
  if (currentPage === 'profile') {
    return (
      <>
        <NavigationBar userName={displayName} onNavigate={handleNavigate} onLogout={handleAuthLogout} isAdmin={isAdmin} />
        <ProfilePage
          userName={displayName}
          userEmail={userEmail}
          stats={profileStats || undefined}
          isLoading={isFetchingProfileStats}
          errorMessage={profileStatsError}
          onRetryFetchStats={fetchProfileStats}
        />
        <Toaster />
      </>
    );
  }

  // Arkadaşlar sayfasını göster
  if (currentPage === 'friends') {
    return (
      <>
        <NavigationBar userName={displayName} onNavigate={handleNavigate} onLogout={handleAuthLogout} isAdmin={isAdmin} />
        <FriendsPage />
        <Toaster />
      </>
    );
  }

  // Oyun modu seçim sayfasını göster
  if (currentPage === 'gameMode') {
    return (
      <>
        {isAuthenticated && <NavigationBar userName={displayName} onNavigate={handleNavigate} onLogout={handleAuthLogout} isAdmin={isAdmin} />}
        <GameModeSelection 
          onSelectMode={handleGameModeSelect}
        />
        <Toaster />
      </>
    );
  }

  // Kategori seçim sayfasını göster
  if (currentPage === 'category') {
    return (
      <>
        {isAuthenticated && <NavigationBar userName={displayName} onNavigate={handleNavigate} onLogout={handleAuthLogout} isAdmin={isAdmin} />}
        <CategorySelection 
          onSelectCategory={handleCategorySelect}
          onBack={handleBackToHome}
        />
        <Toaster />
      </>
    );
  }

  // Quiz sayfasını göster
  if (currentPage === 'quiz') {
    const isDuelMode = selectedGameMode === 'duel';
    const duelQuestions = duelSession?.questions ?? [];
    const hasOpponent = (duelSession?.players?.length ?? 0) >= 2;
    const questionsToUse = isDuelMode
      ? duelQuestions
      : isFetchingQuestions
        ? []
        : (fetchedQuestions.length > 0 ? fetchedQuestions : quizQuestions);
    const isLoadingForQuiz = isDuelMode ? isLoadingDuelSession : isFetchingQuestions;
    const errorForQuiz = isDuelMode ? (hasOpponent ? duelError : null) : fetchQuestionsError;

    const retryFetchHandler = isDuelMode
      ? (
        duelSession?.code
          ? () => refreshDuelSession(duelSession.code, selectedCategory)
          : selectedCategory
            ? () => createDuelSessionForCategory(selectedCategory)
            : undefined
      )
      : handleRetryFetchQuestions;

    return (
      <>
        {isAuthenticated && <NavigationBar userName={displayName} onNavigate={handleNavigate} onLogout={handleAuthLogout} isAdmin={isAdmin} />}
        <QuizPage 
          category={selectedCategory}
          gameMode={selectedGameMode}
          questions={questionsToUse}
          isLoadingQuestions={isLoadingForQuiz}
          errorMessage={errorForQuiz}
          onRetryFetch={retryFetchHandler}
          onSubmitGuess={isDuelMode ? submitDuelAnswer : submitGuessForQuestion}
          onReportQuestion={reportQuestion}
          onComplete={handleQuizComplete}
          onBack={handleRestartQuiz}
          onExitToHome={handleBackToHome}
          duelSessionCode={duelSession?.code}
          duelStatus={duelSession?.status}
          duelPlayers={duelSession?.players}
          duelScores={duelScores}
          onStartDuelSession={selectedCategory ? () => createDuelSessionForCategory(selectedCategory) : undefined}
          onJoinDuelSession={(code) => joinDuelSessionWithCode(code, selectedCategory)}
          onRefreshDuelSession={duelSession?.code ? () => refreshDuelSession(duelSession.code, selectedCategory) : undefined}
        />
        <Toaster />
      </>
    );
  }

  // Sonuç sayfasını göster
  if (currentPage === 'result') {
    return (
      <>
        {isAuthenticated && <NavigationBar userName={displayName} onNavigate={handleNavigate} onLogout={handleAuthLogout} isAdmin={isAdmin} />}
        <QuizResult
          score={quizScore.score}
          total={quizScore.total}
          onRestart={handleRestartQuiz}
          onBackToHome={handleBackToHome}
        />
        <Toaster />
      </>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/90 rounded-2xl">
            <BookOpen className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-semibold text-primary">Qio yükleniyor...</h2>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen w-full bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo ve Başlık */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4">
              <BookOpen className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-primary mb-2">Qio</h1>
            <p className="text-muted-foreground">Bilginizi test edin, öğrenin ve eğlenin!</p>
          </div>

        <Card>
          <CardHeader>
            <CardTitle>Hesabınıza giriş yapın</CardTitle>
            <CardDescription>
              Auth0 hesabınızla oturum açarak quizlere başlayın
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => loginWithRedirect()}>
              Auth0 ile giriş yap
            </Button>
          </CardContent>
        </Card>

          {/* Footer */}
          <p className="text-center text-muted-foreground mt-6">
            Qio'ya hoş geldiniz
          </p>
        </div>
      </div>
      <Toaster />
    </>
  );
}

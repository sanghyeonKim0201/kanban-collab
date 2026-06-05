"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mic, Square, Plus, X, Sparkles } from "lucide-react";
import { createMeeting } from "@/entities/meeting/api/actions";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";

/** Web Speech API 최소 타입 (lib.dom 미포함 브라우저 API). */
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): { readonly transcript: string };
  [index: number]: { readonly transcript: string };
}
interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    item(index: number): SpeechRecognitionResultLike;
    [index: number]: SpeechRecognitionResultLike;
  };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

type Mode = "audio" | "text" | "live";

/** 시연용 샘플 — 클릭 한 번으로 제목·참가자·회의 내용 채움. */
const SAMPLE_PARTICIPANTS = ["김상현", "이영희", "박철수"];
const SAMPLE_TITLE = "스프린트 주간 회의";
const SAMPLE_TRANSCRIPT = `참석자: 김상현, 이영희, 박철수
[김상현] 이번 스프린트 회의 시작하겠습니다. 첫 안건은 로그인 버그입니다. 사용자가 로그인하면 가끔 토큰이 만료돼 튕기는 문제인데, 제가 이번 주 금요일까지 수정하겠습니다.
[이영희] 두 번째 안건은 결제 API 연동입니다. 제가 맡아서 다음 주 화요일까지 결제 모듈 초안을 작성하겠습니다.
[박철수] 저는 회의록을 매번 수동으로 정리하는 게 비효율적이라, 회의록 자동화 기능을 검토해서 다음 회의 때 공유하겠습니다.`;

export function UploadForm({
  workspaces,
}: {
  workspaces: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<Mode>("live");
  const [title, setTitle] = useState("");

  // 실시간 받아쓰기 상태
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wantRecordingRef = useRef(false); // onend 자동 재시작 판단용

  // 화자(참가자) 상태 — 자동 음성분리 대신 발언자를 눌러 자막에 [이름] 태그.
  const [participants, setParticipants] = useState<string[]>([]);
  const [draftName, setDraftName] = useState("");
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const activeSpeakerRef = useRef<string | null>(null); // onresult 클로저용
  const lastSpeakerRef = useRef<string | null>(null); // 직전 자막의 화자

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
    return () => {
      wantRecordingRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  function addParticipant() {
    const name = draftName.trim();
    if (!name) return;
    if (participants.includes(name)) {
      setDraftName("");
      return;
    }
    setParticipants((prev) => [...prev, name]);
    setDraftName("");
  }

  function removeParticipant(name: string) {
    setParticipants((prev) => prev.filter((p) => p !== name));
    if (activeSpeaker === name) {
      setActiveSpeaker(null);
      activeSpeakerRef.current = null;
    }
  }

  function selectSpeaker(name: string) {
    setActiveSpeaker(name);
    activeSpeakerRef.current = name;
  }

  /** 화자 태그를 붙여 자막에 누적. 화자가 바뀌면 새 줄 [이름] 으로 시작. */
  function appendFinal(prev: string, text: string): string {
    const spk = activeSpeakerRef.current;
    if (!spk) {
      return prev ? `${prev.trimEnd()} ${text}` : text;
    }
    if (spk !== lastSpeakerRef.current) {
      lastSpeakerRef.current = spk;
      return prev ? `${prev.trimEnd()}\n[${spk}] ${text}` : `[${spk}] ${text}`;
    }
    return `${prev.trimEnd()} ${text}`;
  }

  function startRecording() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }

    // 첫 발언자 기본 선택 + 참석자 헤더 1회 삽입.
    const firstSpeaker = activeSpeaker ?? participants[0] ?? null;
    setActiveSpeaker(firstSpeaker);
    activeSpeakerRef.current = firstSpeaker;
    lastSpeakerRef.current = null;
    if (!transcript && participants.length > 0) {
      setTranscript(`참석자: ${participants.join(", ")}\n`);
    }

    const rec = new Ctor();
    rec.lang = "ko-KR";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (event) => {
      let finalChunk = "";
      let interimChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result) continue;
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalChunk += text;
        else interimChunk += text;
      }
      if (finalChunk) {
        setTranscript((prev) => appendFinal(prev, finalChunk.trim()));
      }
      setInterim(interimChunk);
    };

    rec.onerror = (event) => {
      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        toast.error("마이크 권한이 필요합니다");
        wantRecordingRef.current = false;
        setRecording(false);
      }
      // no-speech / aborted 등은 onend 자동 재시작에 맡긴다.
    };

    rec.onend = () => {
      if (wantRecordingRef.current) {
        try {
          rec.start();
        } catch {
          /* 이미 시작된 경우 무시 */
        }
      } else {
        setInterim("");
      }
    };

    recognitionRef.current = rec;
    wantRecordingRef.current = true;
    setRecording(true);
    try {
      rec.start();
    } catch {
      /* start 중복 호출 방지 */
    }
  }

  function stopRecording() {
    wantRecordingRef.current = false;
    setRecording(false);
    recognitionRef.current?.stop();
    setInterim("");
  }

  /** 시연용: 제목·참가자·회의 내용을 한 번에 채운다(녹음 중엔 비활성). */
  function fillSample() {
    setTitle(SAMPLE_TITLE);
    setParticipants([...SAMPLE_PARTICIPANTS]);
    setTranscript(SAMPLE_TRANSCRIPT);
    if (mode === "audio") setMode("text"); // 오디오 모드는 transcript 미표시 → 텍스트로 전환
    toast.success("시안을 채웠습니다");
  }

  function onSubmit(formData: FormData) {
    start(async () => {
      try {
        const id = await createMeeting(formData);
        toast.success("회의록 생성됨");
        router.push(`/meetings/${id}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "생성 실패");
      }
    });
  }

  return (
    <form
      action={onSubmit}
      className="space-y-4 rounded-xl border border-border bg-surface p-5 shadow-card"
    >
      <div className="space-y-1.5">
        <Label htmlFor="ws">워크스페이스</Label>
        <Select name="workspaceId" required defaultValue={workspaces[0]?.id}>
          <SelectTrigger id="ws" aria-label="워크스페이스" className="w-full">
            <SelectValue placeholder="워크스페이스 선택" />
          </SelectTrigger>
          <SelectContent>
            {workspaces.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="title">제목</Label>
        <Input
          id="title"
          name="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 스프린트 킥오프 회의"
        />
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "live" ? "default" : "outline"}
          onClick={() => setMode("live")}
        >
          실시간 회의
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "audio" ? "default" : "outline"}
          onClick={() => setMode("audio")}
        >
          음성 파일
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "text" ? "default" : "outline"}
          onClick={() => setMode("text")}
        >
          텍스트
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="ml-auto text-primary"
          onClick={fillSample}
          disabled={recording}
        >
          <Sparkles className="mr-1.5 h-4 w-4" />
          시안 채우기
        </Button>
      </div>

      {mode === "live" && (
        <div className="space-y-3">
          {!supported ? (
            <p className="rounded-xl border border-dashed border-border bg-surface/40 px-4 py-6 text-center text-xs text-muted-foreground">
              이 브라우저는 실시간 음성인식을 지원하지 않습니다. Chrome 에서
              사용하거나 “텍스트” 탭을 이용하세요.
            </p>
          ) : (
            <>
              {/* 참가자(화자) 등록 */}
              <div className="space-y-2 rounded-xl border border-border bg-surface-2 p-3">
                <Label className="text-xs text-muted-foreground">
                  참가자 (말하는 사람을 눌러가며 진행)
                </Label>
                {!recording && (
                  <div className="flex gap-2">
                    <Input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addParticipant();
                        }
                      }}
                      placeholder="참가자 이름"
                      className="h-8 flex-1"
                      aria-label="참가자 이름"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addParticipant}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {participants.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {participants.map((name) => {
                      const isActive = recording && activeSpeaker === name;
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() =>
                            recording
                              ? selectSpeaker(name)
                              : removeParticipant(name)
                          }
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                            isActive
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-surface text-foreground hover:bg-surface-2"
                          }`}
                          aria-pressed={isActive}
                        >
                          {name}
                          {!recording && (
                            <X className="h-3 w-3 text-muted-foreground" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    참가자를 추가하면 자막에 화자([이름])가 표시됩니다. (없어도
                    진행 가능)
                  </p>
                )}
                {recording && (
                  <p className="text-xs text-muted-foreground">
                    현재 발언자:{" "}
                    <span className="font-medium text-foreground">
                      {activeSpeaker ?? "(지정 안 함)"}
                    </span>{" "}
                    — 바뀌면 위에서 이름을 누르세요.
                  </p>
                )}
              </div>

              {/* 녹음 제어 */}
              <div className="flex items-center gap-3">
                {recording ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={stopRecording}
                  >
                    <Square className="mr-1.5 h-3.5 w-3.5 fill-current" />
                    회의 종료
                  </Button>
                ) : (
                  <Button type="button" size="sm" onClick={startRecording}>
                    <Mic className="mr-1.5 h-4 w-4" />
                    회의 시작
                  </Button>
                )}
                {recording && (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-red-500">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                    녹음 중…
                  </span>
                )}
              </div>

              {/* 실시간 자막 */}
              <div className="rounded-xl border border-border bg-surface-2 p-3">
                <Textarea
                  name="transcript"
                  rows={6}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="‘회의 시작’을 누르고 말하면 여기에 실시간으로 받아써집니다. 종료 후 내용을 다듬을 수 있어요."
                  className="resize-none border-0 bg-transparent p-0 focus-visible:ring-0"
                />
                {interim && (
                  <p className="mt-1 text-sm italic text-muted-foreground">
                    {activeSpeaker ? `[${activeSpeaker}] ` : ""}
                    {interim}
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                종료 후 “생성”하면, 상세 화면에서 AI가 회의록·할 일을 정리합니다.
              </p>
            </>
          )}
        </div>
      )}

      {mode === "audio" && (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 px-4 py-6 text-center">
          <p className="mb-3 text-xs text-muted-foreground">
            .mp3 · .m4a · .wav 파일을 선택하세요
          </p>
          <Input
            type="file"
            name="file"
            accept=".mp3,.m4a,.wav,audio/*"
            className="mx-auto max-w-xs"
          />
        </div>
      )}

      {mode === "text" && (
        <Textarea
          name="transcript"
          rows={6}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="회의 내용을 붙여넣으세요"
          className="resize-none"
        />
      )}

      <Button type="submit" disabled={pending || recording} className="w-full">
        {pending ? "생성 중…" : recording ? "회의 종료 후 생성" : "생성"}
      </Button>
    </form>
  );
}

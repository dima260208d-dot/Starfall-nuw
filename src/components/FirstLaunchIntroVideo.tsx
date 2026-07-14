import { useCallback, useEffect, useRef, useState } from "react";

import { gameMusic } from "../audio/gameMusicService";

import {

  BGM_RELATIVE_VOLUME,

  isMusicEnabled,

  subscribeAudioSettings,

} from "../audio/audioSettings";

import {

  getFirstLaunchIntroStartAudioSrc,

  getFirstLaunchIntroVideoSrc,

  getFirstLaunchIntroWatermarkSrc,

  getFirstLaunchLogoBumperSrc,

} from "../utils/firstLaunchIntro";



interface Props {

  onFinished: () => void;

}



type Phase = "bumper" | "main";



export default function FirstLaunchIntroVideo({ onFinished }: Props) {

  const bumperRef = useRef<HTMLVideoElement>(null);

  const mainRef = useRef<HTMLVideoElement>(null);

  const startAudioRef = useRef<HTMLAudioElement | null>(null);

  const finishedRef = useRef(false);

  const bumperDoneRef = useRef(false);

  const mainReadyRef = useRef(false);



  const bumperSrc = getFirstLaunchLogoBumperSrc();

  const mainSrc = getFirstLaunchIntroVideoSrc();

  const startAudioSrc = getFirstLaunchIntroStartAudioSrc();



  const [phase, setPhase] = useState<Phase>(() => (bumperSrc ? "bumper" : "main"));

  const [fadeOut, setFadeOut] = useState(false);

  const [bumperVisible, setBumperVisible] = useState(false);

  const [mainVisible, setMainVisible] = useState(false);

  const [needsTap, setNeedsTap] = useState(false);



  const finish = useCallback(() => {

    if (finishedRef.current) return;

    finishedRef.current = true;

    startAudioRef.current?.pause();

    bumperRef.current?.pause();

    mainRef.current?.pause();

    setFadeOut(true);

    window.setTimeout(onFinished, 900);

  }, [onFinished]);



  const beginMainPhase = useCallback(() => {

    if (bumperDoneRef.current) return;

    bumperDoneRef.current = true;

    startAudioRef.current?.pause();

    startAudioRef.current = null;

    bumperRef.current?.pause();

    setBumperVisible(false);

    setPhase("main");

  }, []);



  /** Wait until main intro is buffered before showing it. */

  const beginMainPhaseWhenReady = useCallback(() => {

    const video = mainRef.current;

    if (!video || !mainSrc) {

      beginMainPhase();

      return;

    }

    if (mainReadyRef.current || video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {

      beginMainPhase();

      return;

    }

    let settled = false;

    const proceed = () => {

      if (settled) return;

      settled = true;

      video.removeEventListener("canplaythrough", onReady);

      video.removeEventListener("loadeddata", onReady);

      window.clearTimeout(fallback);

      beginMainPhase();

    };

    const onReady = () => proceed();

    video.addEventListener("canplaythrough", onReady);

    video.addEventListener("loadeddata", onReady);

    const fallback = window.setTimeout(proceed, 8000);

  }, [beginMainPhase, mainSrc]);



  useEffect(() => {

    if (bumperSrc || mainSrc) return;

    finish();

  }, [bumperSrc, mainSrc, finish]);



  // Preload main intro while bumper plays.

  useEffect(() => {

    if (!mainSrc) return;

    const video = mainRef.current;

    if (!video) return;

    mainReadyRef.current = false;

    if (video.getAttribute("src") !== mainSrc) {

      video.src = mainSrc;

    }

    video.preload = "auto";

    video.load();



    const onReady = () => {

      mainReadyRef.current = true;

    };

    video.addEventListener("canplaythrough", onReady);

    video.addEventListener("loadeddata", onReady);



    const link = document.createElement("link");

    link.rel = "preload";

    link.as = "video";

    link.href = mainSrc;

    document.head.appendChild(link);



    return () => {

      video.removeEventListener("canplaythrough", onReady);

      video.removeEventListener("loadeddata", onReady);

      link.remove();

    };

  }, [mainSrc]);



  // Logo bumper + начало.mp3

  useEffect(() => {

    if (phase !== "bumper") return;

    if (!bumperSrc) {

      beginMainPhaseWhenReady();

      return;

    }



    const video = bumperRef.current;

    if (!video) return;



    let audio: HTMLAudioElement | null = null;

    if (isMusicEnabled()) {

      audio = new Audio(startAudioSrc);

      audio.preload = "auto";

      audio.volume = BGM_RELATIVE_VOLUME;

      startAudioRef.current = audio;

    }



    const applyMusicSettings = () => {

      if (!audio) return;

      if (!isMusicEnabled()) {

        audio.pause();

        return;

      }

      audio.volume = BGM_RELATIVE_VOLUME;

    };



    const unsubAudio = subscribeAudioSettings(applyMusicSettings);



    const onBumperEnd = () => beginMainPhaseWhenReady();

    const onBumperPlaying = () => setBumperVisible(true);

    video.addEventListener("ended", onBumperEnd);

    video.addEventListener("error", onBumperEnd);

    video.addEventListener("playing", onBumperPlaying);



    const tryPlay = () => {

      void video.play().catch(onBumperEnd);

      if (audio && isMusicEnabled()) {

        void audio.play().catch(() => {

          /* video still plays if audio blocked */

        });

      }

    };



    if (video.readyState >= 2) tryPlay();

    else video.addEventListener("loadeddata", tryPlay, { once: true });



    const safety = window.setTimeout(onBumperEnd, 8000);



    return () => {

      window.clearTimeout(safety);

      video.removeEventListener("ended", onBumperEnd);

      video.removeEventListener("error", onBumperEnd);

      video.removeEventListener("playing", onBumperPlaying);

      unsubAudio();

      audio?.pause();

    };

  }, [phase, bumperSrc, startAudioSrc, beginMainPhaseWhenReady]);



  // Main cinematic intro

  useEffect(() => {

    if (phase !== "main") return;



    gameMusic.crossfadeTo("loading");



    if (!mainSrc) {

      finish();

      return;

    }



    const video = mainRef.current;

    if (!video) return;



    const showAndPlay = () => {

      const onPlaying = () => {

        setMainVisible(true);

        setNeedsTap(false);

      };

      video.addEventListener("playing", onPlaying, { once: true });



      const tryPlay = () => {

        void video.play().catch(() => setNeedsTap(true));

      };

      if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) tryPlay();

      else video.addEventListener("canplaythrough", tryPlay, { once: true });

    };



    if (mainReadyRef.current || video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {

      showAndPlay();

    } else {

      const onReady = () => showAndPlay();

      video.addEventListener("canplaythrough", onReady, { once: true });

      video.addEventListener("loadeddata", onReady, { once: true });

    }



    video.addEventListener("ended", finish);

    video.addEventListener("error", finish);



    const safety = window.setTimeout(finish, 45_000);



    return () => {

      window.clearTimeout(safety);

      video.removeEventListener("ended", finish);

      video.removeEventListener("error", finish);

    };

  }, [phase, mainSrc, finish]);



  const handleTapPlay = useCallback(() => {

    const video = mainRef.current;

    if (!video) return;

    void video

      .play()

      .then(() => {

        setMainVisible(true);

        setNeedsTap(false);

      })

      .catch(() => finish());

  }, [finish]);



  if (!bumperSrc && !mainSrc) return null;



  const showBumper = phase === "bumper" && !!bumperSrc && bumperVisible;

  const showMain = phase === "main" && !!mainSrc && mainVisible;



  return (

    <div

      style={{

        position: "fixed",

        inset: 0,

        zIndex: 2000,

        background: "#000",

        opacity: fadeOut ? 0 : 1,

        transition: "opacity 0.85s ease",

        pointerEvents: fadeOut ? "none" : "auto",

      }}

      onClick={needsTap ? handleTapPlay : undefined}

    >

      <video

        ref={bumperRef}

        className="boot-intro-video"

        src={bumperSrc || undefined}

        playsInline

        muted

        preload="auto"

        controls={false}

        controlsList="nodownload nofullscreen noremoteplayback"

        disablePictureInPicture

        disableRemotePlayback

        style={{

          position: "absolute",

          inset: 0,

          width: "100%",

          height: "100%",

          objectFit: "cover",

          background: "#000",

          opacity: showBumper ? 1 : 0,

          visibility: showBumper ? "visible" : "hidden",

          zIndex: 1,

          pointerEvents: "none",

        }}

      />



      {phase === "main" && !mainVisible && (

        <div

          style={{

            position: "absolute",

            inset: 0,

            zIndex: 2,

            background: "#000",

            display: "flex",

            alignItems: "center",

            justifyContent: "center",

            color: "rgba(255,255,255,0.55)",

            fontSize: 14,

            letterSpacing: "0.12em",

          }}

        >

          …

        </div>

      )}



      <video

        ref={mainRef}

        className="boot-intro-video"

        src={mainSrc || undefined}

        playsInline

        muted

        preload="auto"

        controls={false}

        controlsList="nodownload nofullscreen noremoteplayback"

        disablePictureInPicture

        disableRemotePlayback

        style={{

          position: "absolute",

          inset: 0,

          width: "100%",

          height: "100%",

          objectFit: "cover",

          background: "#000",

          opacity: showMain ? 1 : 0,

          visibility: showMain ? "visible" : "hidden",

          zIndex: 3,

          pointerEvents: "none",

        }}

      />



      {needsTap && showMain && (

        <div

          style={{

            position: "absolute",

            inset: 0,

            zIndex: 6,

            display: "flex",

            alignItems: "center",

            justifyContent: "center",

            background: "rgba(0,0,0,0.35)",

            color: "#fff",

            fontSize: 16,

            fontWeight: 700,

            letterSpacing: "0.08em",

            cursor: "pointer",

          }}

        >

          Tap to continue

        </div>

      )}



      {showMain && (

        <>

          <div

            style={{

              position: "absolute",

              right: "2%",

              bottom: "2%",

              width: "min(28vw, 180px)",

              minWidth: 100,

              display: "flex",

              alignItems: "flex-end",

              justifyContent: "flex-end",

              pointerEvents: "none",

              zIndex: 5,

            }}

          >

            <img

              src={getFirstLaunchIntroWatermarkSrc()}

              alt=""

              draggable={false}

              style={{

                width: "100%",

                height: "auto",

                objectFit: "contain",

                filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.75))",

              }}

            />

          </div>



          <div

            aria-hidden

            style={{

              position: "absolute",

              right: 0,

              bottom: 0,

              width: "min(34vw, 220px)",

              height: "min(18vw, 90px)",

              background: "linear-gradient(135deg, transparent 20%, rgba(0,0,0,0.55) 100%)",

              pointerEvents: "none",

              zIndex: 4,

            }}

          />

        </>

      )}

    </div>

  );

}



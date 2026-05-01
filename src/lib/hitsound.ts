import { hitsoundConfig } from "../config";
import type { HitObject, TimingPoint } from "./osuParser";

export interface HitsoundInfo {
  filename: string;
  volume: number;
}

/**
 * Resolve effective volume using priority chain:
 * hitSample.volume > timingPoint.volume > globalVolume
 */
function resolveVolume(
  hitSampleVolume: number | undefined,
  timingPointVolume: number | undefined,
  globalVolume: number,
): number {
  if (hitSampleVolume !== undefined && hitSampleVolume !== null) {
    return hitSampleVolume / 100; // Convert osu! 0-100 to 0-1
  }
  if (timingPointVolume !== undefined && timingPointVolume !== null) {
    return timingPointVolume / 100;
  }
  return globalVolume;
}

/**
 * Resolve sample set using priority chain:
 * hitObject.normalSet > timingPoint.sampleSet > default (1)
 */
function resolveSampleSet(
  hitObject: HitObject,
  timingPoint: TimingPoint | undefined,
): number {
  if (hitObject.parsedHitSample) {
    if (hitObject.parsedHitSample.normalSet > 0) {
      return hitObject.parsedHitSample.normalSet;
    } else if (timingPoint) {
      return timingPoint.sampleSet ?? 1;
    }
  } else if (timingPoint) {
    return timingPoint.sampleSet ?? 1;
  }
  return 1;
}

/**
 * Parse hitSound bit flags into sound type names.
 *
 * Bit flags (osu! standard):
 * - 0b0001 = normal
 * - 0b0010 = whistle
 * - 0b0100 = finish
 * - 0b1000 = clap
 */
function parseSoundTypes(hitSound: number): string[] {
  const types: string[] = [];
  if (hitSound & hitsoundConfig.hitSoundFlags.normal) types.push("normal");
  if (hitSound & hitsoundConfig.hitSoundFlags.whistle) types.push("whistle");
  if (hitSound & hitsoundConfig.hitSoundFlags.finish) types.push("finish");
  if (hitSound & hitsoundConfig.hitSoundFlags.clap) types.push("clap");
  return types;
}

/**
 * HitsoundManager - manages audio file loading, caching, and playback.
 *
 * Handles missing files silently by tracking them in a Set and skipping playback.
 * Supports concurrent sound limiting for performance.
 */
export class HitsoundManager {
  private audioCache: Map<string, HTMLAudioElement> = new Map();
  private missingFiles: Set<string> = new Set();
  private activeSounds: HTMLAudioElement[] = [];

  /**
   * Get sound file paths for a hit object based on hitSound flags and sample set.
   *
   * Returns an array of filenames to play. Empty array if no sounds match.
   */
  getHitSoundFiles(
    hitSound: number,
    sampleSet: number,
    hitSample?: { index?: number },
  ): string[] {
    const soundTypes = parseSoundTypes(hitSound);
    if (soundTypes.length === 0) return [];

    const sampleSetName = hitsoundConfig.sampleSets[sampleSet as keyof typeof hitsoundConfig.sampleSets] ?? "normal";
    const files: string[] = [];

    for (const soundType of soundTypes) {
      let filename = hitsoundConfig.soundFileTemplate(
        sampleSetName,
        soundType,
        hitSample?.index,
      );
      // Map to soft- prefix if original doesn't exist
      if (!hitsoundConfig.availableFiles.has(filename)) {
        filename = filename.replace(/^(normal|drum|inherit)-/, "soft-");
      }
      // Try normal- as last resort fallback
      if (!hitsoundConfig.availableFiles.has(filename)) {
        filename = filename.replace(/^(soft|drum|inherit)-/, "normal-");
      }
      // Only add if file exists
      if (hitsoundConfig.availableFiles.has(filename)) {
        files.push(filename);
      }
    }

    return files;
  }

  /**
   * Play a hitsound file by filename.
   *
   * Returns false if the file is missing or cannot be played.
   * Missing files are tracked and silently skipped on subsequent calls.
   * If a fallback sound is configured, it will be tried when the original fails.
   */
  play(filename: string, volume: number, useFallback: boolean = true): boolean {
    if (process.env.NODE_ENV !== "production") {
      console.log("[hitsound] play()", {
        filename,
        volume,
        useFallback,
        isMissing: this.missingFiles.has(filename),
      });
    }
    // Check if we've already identified this file as missing
    if (this.missingFiles.has(filename)) {
      return false;
    }

    // Enforce concurrent sound limit
    const maxConcurrent = hitsoundConfig.maxConcurrentSounds;
    if (maxConcurrent > 0 && this.activeSounds.length >= maxConcurrent) {
      return false;
    }

    // Get or create audio element
    let audio = this.audioCache.get(filename);

    if (!audio) {
      audio = new Audio(`${hitsoundConfig.basePath}${filename}`);
      audio.volume = volume;

      // Cache on successful load
      audio.addEventListener("canplaythrough", () => {
        this.audioCache.set(filename, audio!);
      }, { once: true });

      // Track missing files and try fallback
      audio.addEventListener("error", () => {
        this.missingFiles.add(filename);
        this.audioCache.delete(filename);
        this.activeSounds = this.activeSounds.filter((a) => a !== audio);
        
        // Try fallback sound if enabled
        if (useFallback) {
          this.tryFallback(filename, volume);
        }
      }, { once: true });

      // Remove from active list when done
      audio.addEventListener("ended", () => {
        this.activeSounds = this.activeSounds.filter((a) => a !== audio);
      }, { once: true });
    }

    // Clone to allow concurrent playback of the same sound
    const audioClone = audio.cloneNode() as HTMLAudioElement;
    audioClone.volume = volume;

    // Reset to start for re-triggering
    audioClone.currentTime = 0;

    const playPromise = audioClone.play();
    if (playPromise) {
      playPromise.catch((error) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Hitsound playback failed:", filename, error);
        }
        this.missingFiles.add(filename);
        this.activeSounds = this.activeSounds.filter((a) => a !== audioClone);
        
        // Try fallback sound if enabled
        if (useFallback) {
          this.tryFallback(filename, volume);
        }
      });
      this.activeSounds.push(audioClone);
      return true;
    }

    return false;
  }

  /**
   * Try to play a fallback sound for the given filename.
   * Extracts the sound type (normal/whistle/finish/clap) and plays the corresponding fallback.
   */
  private tryFallback(filename: string, volume: number): void {
    // Extract sound type from filename (e.g., "normal-hitnormal.wav" -> "normal")
    const match = filename.match(/^(\w+)-hit\w+\.wav$/);
    if (!match) return;
    
    const sampleSet = match[1];
    
    // Try to find a fallback for this sample set
    // Priority: same sample set -> soft -> normal
    const fallbackOrder = sampleSet === "soft" 
      ? ["soft", "normal"] 
      : sampleSet === "normal" 
        ? ["normal", "soft"] 
        : [sampleSet, "soft", "normal"];
    
    for (const setName of fallbackOrder) {
      const fallbackFile = hitsoundConfig.fallbackSounds[setName as keyof typeof hitsoundConfig.fallbackSounds];
      if (fallbackFile && !this.missingFiles.has(fallbackFile)) {
        // Try to play fallback (with useFallback=false to prevent infinite recursion)
        this.play(fallbackFile, volume, false);
        break;
      }
    }
  }

  /**
   * Play hitsound for a hit object at the judgment line.
   *
   * Volume priority: hitSample.volume > timingPoint.volume > globalVolume
   */
  playHitObjectHitSound(
    hitObject: HitObject,
    timingPoint: TimingPoint | undefined,
    globalVolume: number,
  ): void {
    const sampleSet = resolveSampleSet(hitObject, timingPoint);
    const hitSound = hitObject.hitSound;
    const volume = resolveVolume(
      hitObject.parsedHitSample?.volume,
      timingPoint?.volume,
      globalVolume,
    );

    if (hitSound === 0) {
      // Default hit sound when hitSound is 0 (osu! standard)
      this.play("soft-hitnormal.wav", volume);
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      const files = this.getHitSoundFiles(hitSound, sampleSet);
      console.log("[hitsound] playHitObjectHitSound()", {
        hitSound,
        sampleSet,
        files,
        volume,
      });
    }

    const files = this.getHitSoundFiles(
      hitSound,
      sampleSet,
      hitObject.parsedHitSample,
    );

    for (const file of files) {
      this.play(file, volume);
    }
  }

  /**
   * Get hitsound info for a hit object without playing.
   * Used by React <Audio> components for proper Remotion integration.
   */
  getHitsoundsForNote(
    hitObject: HitObject,
    timingPoint: TimingPoint | undefined,
    globalVolume: number,
  ): HitsoundInfo[] {
    const sampleSet = resolveSampleSet(hitObject, timingPoint);
    const hitSound = hitObject.hitSound;

    // Default hit sound when hitSound is 0 (osu! standard)
    if (hitSound === 0) {
      const volume = resolveVolume(
        hitObject.parsedHitSample?.volume,
        timingPoint?.volume,
        globalVolume,
      );
      return [{ filename: "soft-hitnormal.wav", volume }];
    }

    const files = this.getHitSoundFiles(hitSound, sampleSet, hitObject.parsedHitSample);
    const volume = resolveVolume(
      hitObject.parsedHitSample?.volume,
      timingPoint?.volume,
      globalVolume,
    );

    return files.map(filename => ({ filename, volume }));
  }

  /**
   * Get set of missing files (for debugging).
   */
  getMissingFiles(): ReadonlySet<string> {
    return this.missingFiles;
  }
}

// Singleton instance
export const hitsoundManager = new HitsoundManager();

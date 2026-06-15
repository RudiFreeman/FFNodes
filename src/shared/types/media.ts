// Метаданные медиафайла — доменный тип (зеркало Rust-структуры MediaInfo из ffprobe).
// Живёт в types/, а не в api/, чтобы доменная логика (lib/ffmpeg) могла зависеть от него,
// не импортируя из слоя api (направление зависимостей FSD: lib не зависит от api).
export interface MediaInfo {
  duration: number | null;
  width: number | null;
  height: number | null;
  // Видео
  video_codec: string | null;
  video_codec_long: string | null; // полное имя кодека
  video_profile: string | null; // профиль (High, Main 10…)
  video_bitrate: number | null; // бит/с
  aspect_ratio: string | null; // соотношение сторон («9:16»)
  pix_fmt: string | null; // формат пикселей («yuv420p10le»)
  color_space: string | null; // цветовое пространство («bt709»)
  frame_count: number | null; // число кадров
  // Звук
  audio_codec: string | null;
  audio_codec_long: string | null; // полное имя кодека аудио
  audio_bitrate: number | null; // бит/с
  audio_sample_rate: number | null; // Гц
  audio_channels: number | null; // число каналов (2 = стерео)
  channel_layout: string | null; // раскладка каналов
  sample_fmt: string | null; // формат сэмплов
  // Общее
  fps: number | null;
  size_bytes: number | null;
  format: string | null;
  format_long: string | null; // полное имя контейнера
  stream_count: number | null; // число потоков
  creation_time: string | null; // дата создания
  encoder: string | null; // энкодер
}

import Image from 'next/image';

interface NewsCardProps {
  title: string;
  source: string;
  thumbnail?: string;
  url?: string;
}

/**
 * News item card with thumbnail (80x60px) and horizontal layout
 */
export function NewsCard({ title, source, thumbnail, url }: NewsCardProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 bg-surface/40 backdrop-blur-sm border border-border/50 rounded-lg p-3 hover:bg-surface/60 transition-colors"
    >
      {thumbnail && (
        <div className="flex-shrink-0 w-20 h-15 bg-border/30 rounded overflow-hidden">
          <Image
            src={thumbnail}
            alt={title}
            width={80}
            height={60}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-elevated text-sm line-clamp-2">{title}</h3>
        <p className="text-xs text-base/60 mt-1">{source}</p>
      </div>
    </a>
  );
}

export default NewsCard;

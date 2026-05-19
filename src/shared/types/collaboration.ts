export interface Peer {
  userId: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  viewingCardId: string | null;
}

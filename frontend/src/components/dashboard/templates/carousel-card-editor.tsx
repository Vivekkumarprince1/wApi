"use client";

import React from 'react';
import {
  Plus,
  Trash2,
  ImageIcon,
  Video,
  ExternalLink,
  GripVertical,
  UploadCloud,
  Loader2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Carousel Card shape — matches Gupshup's cardList structure.
 * POST /partner/dashboard/{appId}/templates-carouselimage
 * POST /partner/dashboard/{appId}/templates-carouselvideo
 */
export interface CarouselCard {
  headerFormat: 'IMAGE' | 'VIDEO';
  mediaUrl: string;
  mediaHandle: string;
  bodyText: string;
  buttons: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
    text: string;
    url?: string;
    phoneNumber?: string;
  }>;
}

interface CarouselCardEditorProps {
  cards: CarouselCard[];
  onChange: (cards: CarouselCard[]) => void;
  onUploadMedia?: (cardIndex: number, file: File) => Promise<{ url: string; handle?: string }>;
  isUploading?: boolean;
  uploadingCardIndex?: number;
}

const MAX_CARDS = 10;
const MAX_BUTTONS_PER_CARD = 2;

function createEmptyCard(): CarouselCard {
  return {
    headerFormat: 'IMAGE',
    mediaUrl: '',
    mediaHandle: '',
    bodyText: '',
    buttons: [{ type: 'QUICK_REPLY', text: '' }]
  };
}

export default function CarouselCardEditor({ 
  cards, 
  onChange, 
  onUploadMedia,
  isUploading = false,
  uploadingCardIndex = -1
}: CarouselCardEditorProps) {

  const addCard = () => {
    if (cards.length >= MAX_CARDS) return;
    onChange([...cards, createEmptyCard()]);
  };

  const removeCard = (index: number) => {
    if (cards.length <= 1) return;
    onChange(cards.filter((_, i) => i !== index));
  };

  const updateCard = (index: number, updates: Partial<CarouselCard>) => {
    const newCards = [...cards];
    newCards[index] = { ...newCards[index], ...updates };
    onChange(newCards);
  };

  const addButton = (cardIndex: number) => {
    const card = cards[cardIndex];
    if (card.buttons.length >= MAX_BUTTONS_PER_CARD) return;
    const newButtons = [...card.buttons, { type: 'QUICK_REPLY' as const, text: '' }];
    updateCard(cardIndex, { buttons: newButtons });
  };

  const removeButton = (cardIndex: number, btnIndex: number) => {
    const card = cards[cardIndex];
    const newButtons = card.buttons.filter((_, i) => i !== btnIndex);
    updateCard(cardIndex, { buttons: newButtons });
  };

  const updateButton = (cardIndex: number, btnIndex: number, field: string, value: string) => {
    const card = cards[cardIndex];
    const newButtons = [...card.buttons];
    newButtons[btnIndex] = { ...newButtons[btnIndex], [field]: value };
    updateCard(cardIndex, { buttons: newButtons });
  };

  const handleFileSelect = async (cardIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUploadMedia) return;
    try {
      const result = await onUploadMedia(cardIndex, file);
      updateCard(cardIndex, { 
        mediaUrl: result.url, 
        mediaHandle: result.handle || '' 
      });
    } catch {
      // Error handled by parent
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-violet-500/10 text-violet-600 flex items-center justify-center">
            <ImageIcon className="h-4 w-4" />
          </div>
          <div>
            <Label className="text-[11px] font-black uppercase tracking-widest text-foreground">
              Carousel Cards
            </Label>
            <p className="text-[9px] text-muted-foreground font-medium">
              {cards.length}/{MAX_CARDS} cards · Each card can have media, body text, and up to 2 buttons
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addCard}
          disabled={cards.length >= MAX_CARDS}
          className="rounded-xl h-8 px-3 text-xs font-black border-primary/20 text-primary hover:bg-primary/5"
        >
          <Plus className="h-3 w-3 mr-1" /> Add Card
        </Button>
      </div>

      {/* Horizontal scrollable card list */}
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
        {cards.map((card, cardIndex) => (
          <div
            key={cardIndex}
            className="snap-start shrink-0 w-[280px] bg-card border-2 border-border/50 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow relative group"
          >
            {/* Card header */}
            <div className="bg-muted/30 px-4 py-2.5 border-b border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground opacity-40" />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Card {cardIndex + 1}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Select
                  value={card.headerFormat}
                  onValueChange={(val) => updateCard(cardIndex, { headerFormat: val as 'IMAGE' | 'VIDEO' })}
                >
                  <SelectTrigger className="h-6 w-20 rounded-lg text-[9px] font-bold border-border/50 bg-transparent">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg">
                    <SelectItem value="IMAGE" className="text-xs rounded-md">Image</SelectItem>
                    <SelectItem value="VIDEO" className="text-xs rounded-md">Video</SelectItem>
                  </SelectContent>
                </Select>
                {cards.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCard(cardIndex)}
                    className="h-6 w-6 rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="p-4 space-y-3">
              {/* Media upload area */}
              <label className={`relative flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                card.mediaUrl 
                  ? 'border-emerald-500/40 bg-emerald-500/5' 
                  : 'border-border/60 hover:bg-muted/20'
              } ${isUploading && uploadingCardIndex === cardIndex ? 'opacity-50 pointer-events-none' : ''}`}>
                {card.mediaUrl ? (
                  card.headerFormat === 'IMAGE' ? (
                    <img src={card.mediaUrl} alt={`Card ${cardIndex + 1}`} className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <video src={card.mediaUrl} className="w-full h-full object-cover rounded-xl" muted />
                  )
                ) : (
                  <div className="flex flex-col items-center gap-1.5">
                    {isUploading && uploadingCardIndex === cardIndex ? (
                      <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                    ) : (
                      <UploadCloud className="h-6 w-6 text-muted-foreground" />
                    )}
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                      {card.headerFormat === 'IMAGE' ? 'Upload Image' : 'Upload Video'}
                    </span>
                  </div>
                )}
                <input
                  type="file"
                  className="hidden"
                  disabled={isUploading}
                  onChange={(e) => handleFileSelect(cardIndex, e)}
                  accept={card.headerFormat === 'IMAGE' ? 'image/jpeg,image/png' : 'video/mp4'}
                />
              </label>

              {/* Body text */}
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Body</Label>
                <Textarea
                  placeholder="Card body text..."
                  className="min-h-[60px] text-xs rounded-xl bg-muted/10 border-border/50 font-medium resize-none"
                  maxLength={160}
                  value={card.bodyText}
                  onChange={(e) => updateCard(cardIndex, { bodyText: e.target.value })}
                />
                <p className="text-[8px] text-muted-foreground text-right font-bold">{card.bodyText.length}/160</p>
              </div>

              {/* Buttons */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Buttons</Label>
                  {card.buttons.length < MAX_BUTTONS_PER_CARD && (
                    <button
                      type="button"
                      onClick={() => addButton(cardIndex)}
                      className="text-[9px] font-black text-primary hover:underline"
                    >
                      + Add
                    </button>
                  )}
                </div>
                {card.buttons.map((btn, btnIndex) => (
                  <div key={btnIndex} className="flex gap-1.5 items-start">
                    <Select
                      value={btn.type}
                      onValueChange={(val) => updateButton(cardIndex, btnIndex, 'type', val)}
                    >
                      <SelectTrigger className="h-8 w-[80px] rounded-lg text-[9px] font-bold border-border/50 bg-transparent shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg">
                        <SelectItem value="QUICK_REPLY" className="text-xs rounded-md">Reply</SelectItem>
                        <SelectItem value="URL" className="text-xs rounded-md">URL</SelectItem>
                        <SelectItem value="PHONE_NUMBER" className="text-xs rounded-md">Call</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex-1 space-y-1">
                      <Input
                        placeholder="Button text"
                        className="h-8 text-[10px] rounded-lg bg-muted/10 border-border/50 font-bold"
                        maxLength={25}
                        value={btn.text}
                        onChange={(e) => updateButton(cardIndex, btnIndex, 'text', e.target.value)}
                      />
                      {btn.type === 'URL' && (
                        <Input
                          placeholder="https://..."
                          className="h-7 text-[9px] rounded-lg bg-muted/5 border-border/30 font-medium"
                          value={btn.url || ''}
                          onChange={(e) => updateButton(cardIndex, btnIndex, 'url', e.target.value)}
                        />
                      )}
                      {btn.type === 'PHONE_NUMBER' && (
                        <Input
                          placeholder="+91..."
                          className="h-7 text-[9px] rounded-lg bg-muted/5 border-border/30 font-medium"
                          value={btn.phoneNumber || ''}
                          onChange={(e) => updateButton(cardIndex, btnIndex, 'phoneNumber', e.target.value)}
                        />
                      )}
                    </div>
                    {card.buttons.length > 0 && (
                      <button
                        type="button"
                        onClick={() => removeButton(cardIndex, btnIndex)}
                        className="h-8 w-6 rounded-md flex items-center justify-center text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* Add card placeholder */}
        {cards.length < MAX_CARDS && (
          <button
            type="button"
            onClick={addCard}
            className="snap-start shrink-0 w-[200px] h-full min-h-[300px] border-2 border-dashed border-border/40 rounded-2xl flex flex-col items-center justify-center gap-3 text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all cursor-pointer"
          >
            <Plus className="h-8 w-8 opacity-40" />
            <span className="text-[10px] font-black uppercase tracking-widest">Add Card</span>
            <span className="text-[8px] font-medium opacity-60">{cards.length}/{MAX_CARDS}</span>
          </button>
        )}
      </div>
    </div>
  );
}

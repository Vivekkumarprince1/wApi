"use client";

import React, { useMemo, useState } from "react";
import { Loader2, Megaphone, Package, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createAd } from "@/lib/api/ads";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  metaSelection?: {
    productCatalogId?: string;
    productCatalogName?: string;
    productSetId?: string;
    productSetName?: string;
    currency?: string;
  };
};

type GenderValue = "ALL" | "MALE" | "FEMALE";
type LaunchState = "PAUSED" | "ACTIVE";
type DisplayFormat = "TEXT" | "CAROUSEL";
type CarouselCard = {
  headline: string;
  description: string;
  imageHash: string;
  imageUrl: string;
  link: string;
};

function defaultStart() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return date.toISOString().slice(0, 16);
}

function csv(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function upperCsv(value: string) {
  return csv(value).map((item) => item.toUpperCase());
}

function FieldNote({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

export function CreateMetaAdModal({ open, onOpenChange, onCreated, metaSelection }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [metaObjective, setMetaObjective] = useState("OUTCOME_ENGAGEMENT");
  const [primaryText, setPrimaryText] = useState("");
  const [headline, setHeadline] = useState("Message us on WhatsApp");
  const [description, setDescription] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("Hi, I want to know more.");
  const [displayFormat, setDisplayFormat] = useState<DisplayFormat>("TEXT");
  const [callToActionType, setCallToActionType] = useState("WHATSAPP_MESSAGE");
  const [imageHash, setImageHash] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [carouselCards, setCarouselCards] = useState<CarouselCard[]>([
    { headline: "Message us on WhatsApp", description: "", imageHash: "", imageUrl: "", link: "" },
    { headline: "Talk to our team", description: "", imageHash: "", imageUrl: "", link: "" },
  ]);
  const [urlTags, setUrlTags] = useState("utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.name}}");
  const [budgetType, setBudgetType] = useState<"DAILY" | "LIFETIME">("DAILY");
  const [budget, setBudget] = useState("1000");
  const [bidStrategy, setBidStrategy] = useState("LOWEST_COST_WITHOUT_CAP");
  const [bidAmount, setBidAmount] = useState("");
  const [countries, setCountries] = useState("IN");
  const [ageMin, setAgeMin] = useState("18");
  const [ageMax, setAgeMax] = useState("65");
  const [gender, setGender] = useState<GenderValue>("ALL");
  const [interestIds, setInterestIds] = useState("");
  const [behaviorIds, setBehaviorIds] = useState("");
  const [facebookPlacement, setFacebookPlacement] = useState(true);
  const [instagramPlacement, setInstagramPlacement] = useState(true);
  const [mobilePlacement, setMobilePlacement] = useState(true);
  const [scheduleStart, setScheduleStart] = useState(defaultStart());
  const [scheduleEnd, setScheduleEnd] = useState("");
  const [desiredStatus, setDesiredStatus] = useState<LaunchState>("PAUSED");

  const parsedCountries = useMemo(() => upperCsv(countries), [countries]);
  const needsBidAmount = bidStrategy !== "LOWEST_COST_WITHOUT_CAP";
  const validCarouselCards = carouselCards.filter((card) =>
    card.headline.trim() && (card.imageHash.trim() || card.imageUrl.trim())
  );
  const canSubmit = Boolean(
    name.trim() &&
    primaryText.trim() &&
    headline.trim() &&
    Number(budget) > 0 &&
    scheduleStart &&
    parsedCountries.length &&
    (displayFormat === "TEXT" || validCarouselCards.length >= 2) &&
    (budgetType === "DAILY" || scheduleEnd) &&
    (!needsBidAmount || Number(bidAmount) > 0)
  );

  const reset = () => {
    setName("");
    setPrimaryText("");
    setDescription("");
    setImageHash("");
    setImageUrl("");
    setDisplayFormat("TEXT");
    setCarouselCards([
      { headline: "Message us on WhatsApp", description: "", imageHash: "", imageUrl: "", link: "" },
      { headline: "Talk to our team", description: "", imageHash: "", imageUrl: "", link: "" },
    ]);
    setScheduleStart(defaultStart());
    setScheduleEnd("");
    setDesiredStatus("PAUSED");
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const toastId = toast.loading("Creating Meta ad...");
    try {
      await createAd({
        name,
        metaObjective,
        primaryText,
        headline,
        description,
        welcomeMessage,
        callToActionType,
        imageHash: imageHash || undefined,
        imageUrl: imageUrl || undefined,
        carouselCards: displayFormat === "CAROUSEL" ? validCarouselCards : [],
        urlTags: urlTags || undefined,
        budget: Number(budget),
        budgetType,
        currency: metaSelection?.currency || "INR",
        productCatalogId: metaSelection?.productCatalogId,
        productCatalogName: metaSelection?.productCatalogName,
        productSetId: metaSelection?.productSetId,
        productSetName: metaSelection?.productSetName,
        bidStrategy,
        bidAmount: needsBidAmount ? Number(bidAmount) : undefined,
        billingEvent: "IMPRESSIONS",
        optimizationGoal: "CONVERSATIONS",
        destinationType: "WHATSAPP",
        scheduleStart: new Date(scheduleStart).toISOString(),
        scheduleEnd: scheduleEnd ? new Date(scheduleEnd).toISOString() : undefined,
        targeting: {
          ageMin: Number(ageMin || 18),
          ageMax: Number(ageMax || 65),
          genders: [gender],
          countries: parsedCountries,
          languages: [],
          interests: csv(interestIds),
          behaviors: csv(behaviorIds),
          customAudiences: [],
          lookalikeLevels: [],
          excludedAudiences: [],
          publisherPlatforms: [
            ...(facebookPlacement ? ["facebook"] : []),
            ...(instagramPlacement ? ["instagram"] : []),
          ],
          devicePlatforms: mobilePlacement ? ["mobile"] : [],
        },
        phoneNumberId: "meta-selected",
        ctaText: "Message us",
        displayFormat,
        publishToMeta: true,
        desiredStatus,
      });
      toast.success(desiredStatus === "ACTIVE" ? "Ad launched on Meta" : "Ad created in Meta as paused", { id: toastId });
      reset();
      onCreated?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || "Could not create Meta ad", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Launch WhatsApp ad</DialogTitle>
              <DialogDescription>Create the campaign, ad set, creative, and ad in the connected customer Meta account.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="campaign" className="py-2">
          <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="campaign">Campaign</TabsTrigger>
            <TabsTrigger value="audience">Audience</TabsTrigger>
            <TabsTrigger value="creative">Creative</TabsTrigger>
            <TabsTrigger value="launch">Launch</TabsTrigger>
          </TabsList>

          <TabsContent value="campaign" className="mt-4 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="meta-ad-name">Campaign name</Label>
              <Input id="meta-ad-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="July catering leads" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Objective</Label>
                <Select value={metaObjective} onValueChange={setMetaObjective}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OUTCOME_ENGAGEMENT">Engagement / messages</SelectItem>
                    <SelectItem value="OUTCOME_TRAFFIC">Traffic</SelectItem>
                    <SelectItem value="OUTCOME_LEADS">Leads</SelectItem>
                  </SelectContent>
                </Select>
                <FieldNote>Engagement is the default for Click-to-WhatsApp conversations.</FieldNote>
              </div>
              <div className="grid gap-2">
                <Label>Budget type</Label>
                <Select value={budgetType} onValueChange={(value: "DAILY" | "LIFETIME") => setBudgetType(value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAILY">Daily budget</SelectItem>
                    <SelectItem value="LIFETIME">Lifetime budget</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="meta-ad-budget">Budget</Label>
                <Input id="meta-ad-budget" value={budget} onChange={(event) => setBudget(event.target.value)} inputMode="decimal" />
              </div>
              <div className="grid gap-2">
                <Label>Bid strategy</Label>
                <Select value={bidStrategy} onValueChange={setBidStrategy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOWEST_COST_WITHOUT_CAP">Lowest cost</SelectItem>
                    <SelectItem value="LOWEST_COST_WITH_BID_CAP">Bid cap</SelectItem>
                    <SelectItem value="COST_CAP">Cost cap</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {needsBidAmount && (
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="meta-ad-bid">Bid or cost cap</Label>
                  <Input id="meta-ad-bid" value={bidAmount} onChange={(event) => setBidAmount(event.target.value)} inputMode="decimal" />
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="audience" className="mt-4 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="meta-ad-countries">Countries</Label>
                <Input id="meta-ad-countries" value={countries} onChange={(event) => setCountries(event.target.value)} placeholder="IN, US" />
              </div>
              <div className="grid gap-2">
                <Label>Gender</Label>
                <Select value={gender} onValueChange={(value: GenderValue) => setGender(value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="MALE">Men</SelectItem>
                    <SelectItem value="FEMALE">Women</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="meta-ad-age-min">Minimum age</Label>
                <Input id="meta-ad-age-min" value={ageMin} onChange={(event) => setAgeMin(event.target.value)} inputMode="numeric" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="meta-ad-age-max">Maximum age</Label>
                <Input id="meta-ad-age-max" value={ageMax} onChange={(event) => setAgeMax(event.target.value)} inputMode="numeric" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="meta-ad-interests">Interest IDs</Label>
                <Input id="meta-ad-interests" value={interestIds} onChange={(event) => setInterestIds(event.target.value)} placeholder="6003139266461, ..." />
                <FieldNote>Optional comma-separated Meta targeting IDs.</FieldNote>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="meta-ad-behaviors">Behavior IDs</Label>
                <Input id="meta-ad-behaviors" value={behaviorIds} onChange={(event) => setBehaviorIds(event.target.value)} placeholder="Optional" />
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border p-3">
              <Label>Placements</Label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={facebookPlacement} onCheckedChange={(checked) => setFacebookPlacement(Boolean(checked))} />
                Facebook
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={instagramPlacement} onCheckedChange={(checked) => setInstagramPlacement(Boolean(checked))} />
                Instagram
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={mobilePlacement} onCheckedChange={(checked) => setMobilePlacement(Boolean(checked))} />
                Mobile devices
              </label>
            </div>
          </TabsContent>

          <TabsContent value="creative" className="mt-4 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="meta-ad-primary-text">Primary text</Label>
              <Textarea
                id="meta-ad-primary-text"
                value={primaryText}
                onChange={(event) => setPrimaryText(event.target.value)}
                placeholder="Book your event menu on WhatsApp. Our team replies in minutes."
                className="min-h-24"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="meta-ad-headline">Headline</Label>
                <Input id="meta-ad-headline" value={headline} onChange={(event) => setHeadline(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="meta-ad-description">Description</Label>
                <Input id="meta-ad-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="meta-ad-welcome">WhatsApp prefill message</Label>
              <Input id="meta-ad-welcome" value={welcomeMessage} onChange={(event) => setWelcomeMessage(event.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Creative format</Label>
                <Select value={displayFormat} onValueChange={(value: DisplayFormat) => setDisplayFormat(value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEXT">Single image or link ad</SelectItem>
                    <SelectItem value="CAROUSEL">Carousel ad</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Call to action</Label>
                <Select value={callToActionType} onValueChange={setCallToActionType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WHATSAPP_MESSAGE">WhatsApp message</SelectItem>
                  </SelectContent>
                </Select>
                <FieldNote>Click-to-WhatsApp ads use Meta's WhatsApp CTA destination.</FieldNote>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="meta-ad-image-hash">Image hash</Label>
                <Input id="meta-ad-image-hash" value={imageHash} onChange={(event) => setImageHash(event.target.value)} placeholder="Optional uploaded Meta image hash" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="meta-ad-image-url">Image URL</Label>
                <Input id="meta-ad-image-url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="Optional public image URL" />
              </div>
            </div>
            {displayFormat === "CAROUSEL" && (
              <div className="grid gap-3 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label>Carousel cards</Label>
                    <FieldNote>Add at least two cards with a headline and image hash or image URL.</FieldNote>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCarouselCards((cards) => [
                      ...cards,
                      { headline: "", description: "", imageHash: "", imageUrl: "", link: "" },
                    ].slice(0, 10))}
                    disabled={carouselCards.length >= 10}
                  >
                    <Plus className="size-4" />
                    Card
                  </Button>
                </div>
                <div className="grid gap-3">
                  {carouselCards.map((card, index) => (
                    <div key={index} className="grid gap-3 rounded-md border bg-muted/20 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">Card {index + 1}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove carousel card ${index + 1}`}
                          onClick={() => setCarouselCards((cards) => cards.filter((_, cardIndex) => cardIndex !== index))}
                          disabled={carouselCards.length <= 2}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label htmlFor={`carousel-headline-${index}`}>Headline</Label>
                          <Input
                            id={`carousel-headline-${index}`}
                            value={card.headline}
                            onChange={(event) => setCarouselCards((cards) => cards.map((item, cardIndex) =>
                              cardIndex === index ? { ...item, headline: event.target.value } : item
                            ))}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor={`carousel-description-${index}`}>Description</Label>
                          <Input
                            id={`carousel-description-${index}`}
                            value={card.description}
                            onChange={(event) => setCarouselCards((cards) => cards.map((item, cardIndex) =>
                              cardIndex === index ? { ...item, description: event.target.value } : item
                            ))}
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor={`carousel-image-hash-${index}`}>Image hash</Label>
                          <Input
                            id={`carousel-image-hash-${index}`}
                            value={card.imageHash}
                            onChange={(event) => setCarouselCards((cards) => cards.map((item, cardIndex) =>
                              cardIndex === index ? { ...item, imageHash: event.target.value } : item
                            ))}
                            placeholder="Preferred when already uploaded to Meta"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor={`carousel-image-url-${index}`}>Image URL</Label>
                          <Input
                            id={`carousel-image-url-${index}`}
                            value={card.imageUrl}
                            onChange={(event) => setCarouselCards((cards) => cards.map((item, cardIndex) =>
                              cardIndex === index ? { ...item, imageUrl: event.target.value } : item
                            ))}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="meta-ad-url-tags">URL tags</Label>
              <Input id="meta-ad-url-tags" value={urlTags} onChange={(event) => setUrlTags(event.target.value)} />
            </div>
          </TabsContent>

          <TabsContent value="launch" className="mt-4 grid gap-4">
            {(metaSelection?.productCatalogId || metaSelection?.productSetId) && (
              <div className="flex gap-3 rounded-lg border bg-muted/30 p-3">
                <Package className="mt-0.5 size-4 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">Commerce catalog attached</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {metaSelection.productCatalogName || metaSelection.productCatalogId}
                    {metaSelection.productSetId ? ` · ${metaSelection.productSetName || metaSelection.productSetId}` : " · all products"}
                  </p>
                </div>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="meta-ad-start">Start time</Label>
                <Input id="meta-ad-start" type="datetime-local" value={scheduleStart} onChange={(event) => setScheduleStart(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="meta-ad-end">End time</Label>
                <Input id="meta-ad-end" type="datetime-local" value={scheduleEnd} onChange={(event) => setScheduleEnd(event.target.value)} />
                <FieldNote>Required only for lifetime budgets.</FieldNote>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Meta launch state</Label>
              <Select value={desiredStatus} onValueChange={(value: LaunchState) => setDesiredStatus(value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAUSED">Create paused for review</SelectItem>
                  <SelectItem value="ACTIVE">Launch active immediately</SelectItem>
                </SelectContent>
              </Select>
              <FieldNote>Paused is safer while Meta reviews the ad and billing settings.</FieldNote>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!canSubmit || submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create ad
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

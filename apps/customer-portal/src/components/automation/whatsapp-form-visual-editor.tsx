"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FieldType = "text" | "email" | "phone" | "number" | "textarea" | "select";

type BuilderField = {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder: string;
  optionsCsv: string;
};

type BuilderScreen = {
  id: string;
  title: string;
  terminal: boolean;
  ctaText: string;
  nextScreenId: string;
  fields: BuilderField[];
};

type VisualBuilderOutput = {
  screens: any[];
  rawFlowJson: any;
};

type Props = {
  initialScreens?: any[];
  disabled?: boolean;
  onChange: (output: VisualBuilderOutput) => void;
};

const generateId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;

const defaultField = (): BuilderField => ({
  id: generateId("field"),
  label: "",
  type: "text",
  required: false,
  placeholder: "",
  optionsCsv: "",
});

const defaultScreen = (): BuilderScreen => ({
  id: generateId("screen"),
  title: "",
  terminal: false,
  ctaText: "Continue",
  nextScreenId: "",
  fields: [defaultField()],
});

const fromIncomingScreens = (incoming: any[] | undefined): BuilderScreen[] => {
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return [defaultScreen()];
  }

  return incoming.map((screen, idx) => {
    const children = Array.isArray(screen?.layout?.children) ? screen.layout.children : [];
    const mappedFields = children
      .map((child: any) => {
        const childType = String(child?.type || "").toLowerCase();
        let type: FieldType = "text";
        if (childType.includes("email")) type = "email";
        if (childType.includes("phone")) type = "phone";
        if (childType.includes("number")) type = "number";
        if (childType.includes("textarea")) type = "textarea";
        if (childType.includes("select") || childType.includes("dropdown")) type = "select";

        const options = Array.isArray(child?.options)
          ? child.options.map((opt: any) => String(opt?.label || opt?.value || ""))
          : [];

        return {
          id: child?.name || generateId("field"),
          label: child?.label || "",
          type,
          required: Boolean(child?.required),
          placeholder: child?.placeholder || "",
          optionsCsv: options.join(", "),
        } as BuilderField;
      })
      .filter((field: BuilderField) => field.label || field.id);

    return {
      id: screen?.id || generateId("screen"),
      title: screen?.title || `Screen ${idx + 1}`,
      terminal: Boolean(screen?.terminal),
      ctaText:
        screen?.data?.navigation?.ctaText ||
        screen?.ctaText ||
        (Boolean(screen?.terminal) ? "Submit" : "Continue"),
      nextScreenId:
        screen?.data?.navigation?.nextScreenId ||
        screen?.nextScreenId ||
        "",
      fields: mappedFields.length > 0 ? mappedFields : [defaultField()],
    };
  });
};

const toFlowChildren = (fields: BuilderField[]) => {
  return fields.map((field) => {
    const base: any = {
      type:
        field.type === "textarea"
          ? "TextArea"
          : field.type === "select"
            ? "Select"
            : "TextInput",
      name: field.id,
      label: field.label,
      required: field.required,
      placeholder: field.placeholder || undefined,
      inputType:
        field.type === "email" || field.type === "phone" || field.type === "number"
          ? field.type
          : "text",
    };

    if (field.type === "select") {
      const options = field.optionsCsv
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => ({ label: x, value: x.toLowerCase().replace(/\s+/g, "_") }));
      base.options = options;
    }

    return base;
  });
};

export default function WhatsAppFormVisualEditor({ initialScreens, disabled, onChange }: Props) {
  const [screens, setScreens] = useState<BuilderScreen[]>(() => fromIncomingScreens(initialScreens));
  const [previewScreenIndex, setPreviewScreenIndex] = useState(0);

  useEffect(() => {
    setScreens(fromIncomingScreens(initialScreens));
  }, [initialScreens]);

  useEffect(() => {
    setPreviewScreenIndex((current) => {
      if (screens.length === 0) return 0;
      return Math.min(current, screens.length - 1);
    });
  }, [screens.length]);

  const generated = useMemo(() => {
    const normalized = screens.map((screen, idx) => {
      const isLast = idx === screens.length - 1;
      const terminal = screen.terminal || isLast;
      const ctaText = screen.ctaText || (terminal ? "Submit" : "Continue");
      return {
        id: screen.id,
        title: screen.title || `Screen ${idx + 1}`,
        terminal,
        layout: {
          type: "SingleColumnLayout",
          children: toFlowChildren(screen.fields),
        },
        data: {
          navigation: {
            ctaText,
            nextScreenId: terminal ? undefined : (screen.nextScreenId || undefined),
          },
        },
      };
    });

    return {
      screens: normalized,
      rawFlowJson: {
        version: "1.0",
        screens: normalized,
      },
    } as VisualBuilderOutput;
  }, [screens]);

  useEffect(() => {
    onChange(generated);
  }, [generated, onChange]);

  const previewScreen = screens[previewScreenIndex] || screens[0];

  const resolveNextPreviewIndex = (currentIndex: number) => {
    const current = screens[currentIndex];
    if (!current) return currentIndex;

    if (current.nextScreenId) {
      const mappedIdx = screens.findIndex((s) => s.id === current.nextScreenId);
      if (mappedIdx >= 0) return mappedIdx;
    }

    return Math.min(screens.length - 1, currentIndex + 1);
  };

  return (
    <div className="relative space-y-4 rounded-2xl border border-border/60 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-black">Visual Screen Builder</p>
          <p className="text-xs text-muted-foreground">Add screens and fields without writing flow JSON.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() =>
            setScreens((prev) => {
              const next = [...prev, defaultScreen()];
              setPreviewScreenIndex(next.length - 1);
              return next;
            })
          }
        >
          <Plus className="mr-2 h-4 w-4" /> Add Screen
        </Button>
      </div>

      <div className="space-y-4">
        {screens.map((screen, screenIdx) => (
          <div key={screen.id} className="space-y-3 rounded-xl border border-border/60 bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={previewScreenIndex === screenIdx ? "default" : "outline"}
                disabled={disabled}
                onClick={() => setPreviewScreenIndex(screenIdx)}
              >
                Preview Screen {screenIdx + 1}
              </Button>
              <Input
                value={screen.title}
                onChange={(e) =>
                  setScreens((prev) =>
                    prev.map((item, idx) =>
                      idx === screenIdx ? { ...item, title: e.target.value } : item
                    )
                  )
                }
                disabled={disabled}
                placeholder={`Screen ${screenIdx + 1} title`}
                className="min-w-[220px] flex-1"
              />
              <label className="flex items-center gap-2 text-xs font-medium whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={screen.terminal}
                  disabled={disabled}
                  onChange={(e) =>
                    setScreens((prev) =>
                      prev.map((item, idx) =>
                        idx === screenIdx ? { ...item, terminal: e.target.checked } : item
                      )
                    )
                  }
                />
                Terminal
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled || screens.length <= 1}
                onClick={() =>
                  setScreens((prev) => prev.filter((_, idx) => idx !== screenIdx))
                }
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Footer CTA Text</label>
                <Input
                  value={screen.ctaText}
                  disabled={disabled}
                  placeholder={screen.terminal ? "Submit" : "Continue"}
                  onChange={(e) =>
                    setScreens((prev) =>
                      prev.map((item, idx) =>
                        idx === screenIdx ? { ...item, ctaText: e.target.value } : item
                      )
                    )
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Next Screen (Branching)</label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  disabled={disabled || screen.terminal}
                  value={screen.nextScreenId}
                  onChange={(e) =>
                    setScreens((prev) =>
                      prev.map((item, idx) =>
                        idx === screenIdx ? { ...item, nextScreenId: e.target.value } : item
                      )
                    )
                  }
                >
                  <option value="">Auto (next screen)</option>
                  {screens
                    .filter((candidate) => candidate.id !== screen.id)
                    .map((candidate, idx) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.title || `Screen ${idx + 1}`}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {screen.fields.map((field, fieldIdx) => (
                <div key={field.id} className="rounded-lg border border-border/50 p-3 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                    <div className="md:col-span-5 space-y-1">
                      <label className="text-xs font-semibold">Label</label>
                      <Input
                        value={field.label}
                        disabled={disabled}
                        onChange={(e) =>
                          setScreens((prev) =>
                            prev.map((item, idx) => {
                              if (idx !== screenIdx) return item;
                              return {
                                ...item,
                                fields: item.fields.map((f, i) =>
                                  i === fieldIdx ? { ...f, label: e.target.value } : f
                                ),
                              };
                            })
                          )
                        }
                        placeholder="Full Name"
                      />
                    </div>

                    <div className="md:col-span-3 space-y-1">
                      <label className="text-xs font-semibold">Type</label>
                      <select
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={field.type}
                        disabled={disabled}
                        onChange={(e) =>
                          setScreens((prev) =>
                            prev.map((item, idx) => {
                              if (idx !== screenIdx) return item;
                              return {
                                ...item,
                                fields: item.fields.map((f, i) =>
                                  i === fieldIdx ? { ...f, type: e.target.value as FieldType } : f
                                ),
                              };
                            })
                          )
                        }
                      >
                        <option value="text">Text</option>
                        <option value="email">Email</option>
                        <option value="phone">Phone</option>
                        <option value="number">Number</option>
                        <option value="textarea">Textarea</option>
                        <option value="select">Select</option>
                      </select>
                    </div>

                    <div className="md:col-span-4 space-y-1">
                      <label className="text-xs font-semibold">Placeholder</label>
                      <Input
                        value={field.placeholder}
                        disabled={disabled}
                        onChange={(e) =>
                          setScreens((prev) =>
                            prev.map((item, idx) => {
                              if (idx !== screenIdx) return item;
                              return {
                                ...item,
                                fields: item.fields.map((f, i) =>
                                  i === fieldIdx ? { ...f, placeholder: e.target.value } : f
                                ),
                              };
                            })
                          )
                        }
                        placeholder="Enter value"
                      />
                    </div>
                  </div>

                  {field.type === 'select' ? (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold">Options (comma separated)</label>
                      <Input
                        value={field.optionsCsv}
                        disabled={disabled}
                        onChange={(e) =>
                          setScreens((prev) =>
                            prev.map((item, idx) => {
                              if (idx !== screenIdx) return item;
                              return {
                                ...item,
                                fields: item.fields.map((f, i) =>
                                  i === fieldIdx ? { ...f, optionsCsv: e.target.value } : f
                                ),
                              };
                            })
                          )
                        }
                        placeholder="A, B, C"
                      />
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <label className="flex items-center gap-2 text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={field.required}
                        disabled={disabled}
                        onChange={(e) =>
                          setScreens((prev) =>
                            prev.map((item, idx) => {
                              if (idx !== screenIdx) return item;
                              return {
                                ...item,
                                fields: item.fields.map((f, i) =>
                                  i === fieldIdx ? { ...f, required: e.target.checked } : f
                                ),
                              };
                            })
                          )
                        }
                      />
                      Required
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={disabled || screen.fields.length <= 1}
                      onClick={() =>
                        setScreens((prev) =>
                          prev.map((item, idx) =>
                            idx === screenIdx
                              ? { ...item, fields: item.fields.filter((_, i) => i !== fieldIdx) }
                              : item
                          )
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                disabled={disabled}
                onClick={() =>
                  setScreens((prev) =>
                    prev.map((item, idx) =>
                      idx === screenIdx ? { ...item, fields: [...item.fields, defaultField()] } : item
                    )
                  )
                }
              >
                <Plus className="mr-2 h-4 w-4" /> Add Field
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden xl:block fixed right-6 top-[96px] z-30 w-[340px]">
        <div className="space-y-3 rounded-xl border border-border/60 bg-card p-3 shadow-2xl">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Live Preview</p>
            <p className="text-xs text-muted-foreground">Screen {previewScreenIndex + 1}/{screens.length}</p>
          </div>

          <div className="flex flex-wrap gap-1">
            {screens.map((screen, idx) => (
              <Button
                key={screen.id}
                type="button"
                size="sm"
                variant={previewScreenIndex === idx ? "default" : "outline"}
                className="h-7 px-2 text-[10px]"
                onClick={() => setPreviewScreenIndex(idx)}
              >
                {screen.title || `Screen ${idx + 1}`}
              </Button>
            ))}
          </div>

          <div className="rounded-[28px] border border-border/70 bg-gradient-to-b from-muted/50 to-background p-3">
            <div className="mx-auto w-full max-w-[280px] rounded-[26px] border border-black/10 bg-white shadow-lg overflow-hidden">
              <div className="h-6 bg-black/90 flex items-center justify-center">
                <div className="h-1.5 w-14 rounded-full bg-white/30" />
              </div>
              <div className="max-h-[420px] overflow-y-auto p-3 space-y-3">
                <div>
                  <p className="text-[13px] font-black text-foreground">
                    {previewScreen?.title || `Screen ${previewScreenIndex + 1}`}
                  </p>
                  {previewScreen?.terminal ? (
                    <p className="text-[10px] text-emerald-600 font-semibold">Terminal step</p>
                  ) : null}
                  {!previewScreen?.terminal ? (
                    <p className="text-[10px] text-muted-foreground">
                      Branching:
                      {previewScreen?.nextScreenId
                        ? ` custom -> ${screens.find((s) => s.id === previewScreen.nextScreenId)?.title || previewScreen.nextScreenId}`
                        : ' auto -> next screen'}
                    </p>
                  ) : null}
                </div>

                {(previewScreen?.fields || []).map((field) => (
                  <div key={field.id} className="space-y-1">
                    <p className="text-[10px] font-semibold text-foreground">
                      {field.label || 'Untitled Field'}
                      {field.required ? <span className="text-destructive"> *</span> : null}
                    </p>

                    {field.type === 'textarea' ? (
                      <textarea
                        className="w-full min-h-[70px] rounded-md border border-border bg-background p-2 text-[11px]"
                        placeholder={field.placeholder || 'Type here'}
                        disabled
                      />
                    ) : field.type === 'select' ? (
                      <select className="h-8 w-full rounded-md border border-border bg-background px-2 text-[11px]" disabled>
                        <option>
                          {field.placeholder || 'Select option'}
                        </option>
                        {field.optionsCsv
                          .split(',')
                          .map((opt) => opt.trim())
                          .filter(Boolean)
                          .map((opt) => (
                            <option key={opt}>{opt}</option>
                          ))}
                      </select>
                    ) : (
                      <input
                        type={field.type === 'phone' ? 'tel' : field.type}
                        className="h-8 w-full rounded-md border border-border bg-background px-2 text-[11px]"
                        placeholder={field.placeholder || 'Enter value'}
                        disabled
                      />
                    )}
                  </div>
                ))}

                {(!previewScreen?.fields || previewScreen.fields.length === 0) ? (
                  <p className="text-[11px] text-muted-foreground">No fields added yet.</p>
                ) : null}

                <Button
                  type="button"
                  className="w-full h-8 text-[11px] font-bold"
                  onClick={() => {
                    if (previewScreen?.terminal) return;
                    setPreviewScreenIndex((idx) => resolveNextPreviewIndex(idx));
                  }}
                >
                  {previewScreen?.ctaText || (previewScreen?.terminal ? 'Submit' : 'Continue')}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={previewScreenIndex <= 0}
              onClick={() => setPreviewScreenIndex((idx) => Math.max(0, idx - 1))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Prev
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={previewScreenIndex >= screens.length - 1}
              onClick={() => setPreviewScreenIndex((idx) => Math.min(screens.length - 1, idx + 1))}
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="lg:hidden space-y-3 rounded-xl border border-border/60 bg-card p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Live Preview</p>
          <p className="text-xs text-muted-foreground">Screen {previewScreenIndex + 1}/{screens.length}</p>
        </div>

        <div className="rounded-[22px] border border-border/70 bg-gradient-to-b from-muted/50 to-background p-2">
          <div className="w-full rounded-[20px] border border-black/10 bg-white shadow overflow-hidden">
            <div className="h-5 bg-black/90 flex items-center justify-center">
              <div className="h-1.5 w-12 rounded-full bg-white/30" />
            </div>
            <div className="max-h-[300px] overflow-y-auto p-2.5 space-y-2.5">
              <p className="text-[12px] font-black text-foreground">
                {previewScreen?.title || `Screen ${previewScreenIndex + 1}`}
              </p>
              {(previewScreen?.fields || []).map((field) => (
                <div key={field.id} className="space-y-1">
                  <p className="text-[10px] font-semibold text-foreground">{field.label || 'Untitled Field'}</p>
                  <input className="h-8 w-full rounded-md border border-border bg-background px-2 text-[11px]" placeholder={field.placeholder || 'Enter value'} disabled />
                </div>
              ))}
              <Button type="button" className="w-full h-8 text-[11px] font-bold" disabled>
                {previewScreen?.ctaText || (previewScreen?.terminal ? 'Submit' : 'Continue')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

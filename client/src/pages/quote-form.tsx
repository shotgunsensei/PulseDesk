import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams, useSearch } from "wouter";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { calcLineItemsTotal, calcTotalWithTaxDiscount } from "@shared/schema";
import type { Customer, Quote, QuoteItem } from "@shared/schema";

interface LineItem {
  id?: string;
  description: string;
  qty: string;
  unitPrice: string;
}

export default function QuoteForm() {
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id && id !== "new";
  const [, navigate] = useLocation();
  const searchParams = useSearch();
  const params = new URLSearchParams(searchParams);
  const { toast } = useToast();

  const [customerId, setCustomerId] = useState(params.get("customerId") || "");
  const [jobId, setJobId] = useState(params.get("jobId") || "");
  const [taxRate, setTaxRate] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([
    { description: "", qty: "1", unitPrice: "0" },
  ]);

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: existingQuote } = useQuery<Quote & { items?: QuoteItem[] }>({
    queryKey: ["/api/quotes", id],
    enabled: isEditing,
  });

  useEffect(() => {
    if (existingQuote) {
      setCustomerId(existingQuote.customerId || "");
      setJobId(existingQuote.jobId || "");
      setTaxRate(existingQuote.taxRate || "0");
      setDiscount(existingQuote.discount || "0");
      setNotes(existingQuote.notes || "");
      if (existingQuote.items && existingQuote.items.length > 0) {
        setItems(
          existingQuote.items.map((it) => ({
            id: it.id,
            description: it.description,
            qty: String(it.qty),
            unitPrice: String(it.unitPrice),
          }))
        );
      }
    }
  }, [existingQuote]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEditing) {
        await apiRequest("PATCH", `/api/quotes/${id}`, data);
      } else {
        await apiRequest("POST", "/api/quotes", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      navigate("/quotes");
      toast({ title: isEditing ? "Quote updated" : "Quote created" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const addItem = () => {
    setItems([...items, { description: "", qty: "1", unitPrice: "0" }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof LineItem, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const subtotal = calcLineItemsTotal(items);
  const totals = calcTotalWithTaxDiscount(subtotal, taxRate, discount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({
      customerId: customerId || null,
      jobId: jobId || null,
      taxRate,
      discount,
      notes,
      items: items.filter((it) => it.description.trim()),
    });
  };

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={isEditing ? "Edit Quote" : "New Quote"}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("/quotes")} data-testid="button-back-quotes">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Customer</Label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-testid="select-quote-customer"
              >
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                data-testid="input-quote-notes"
                placeholder="Quote notes..."
              />
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm">Line Items</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addItem} data-testid="button-add-line-item">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="flex items-end gap-3">
                  <div className="flex-1 space-y-1">
                    {i === 0 && <Label className="text-xs">Description</Label>}
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(i, "description", e.target.value)}
                      placeholder="Service or material..."
                      data-testid={`input-item-desc-${i}`}
                    />
                  </div>
                  <div className="w-20 space-y-1">
                    {i === 0 && <Label className="text-xs">Qty</Label>}
                    <Input
                      type="number"
                      step="0.01"
                      value={item.qty}
                      onChange={(e) => updateItem(i, "qty", e.target.value)}
                      data-testid={`input-item-qty-${i}`}
                    />
                  </div>
                  <div className="w-28 space-y-1">
                    {i === 0 && <Label className="text-xs">Unit Price</Label>}
                    <Input
                      type="number"
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                      data-testid={`input-item-price-${i}`}
                    />
                  </div>
                  <div className="w-24 text-right space-y-1">
                    {i === 0 && <Label className="text-xs">Total</Label>}
                    <p className="text-sm font-medium py-2">
                      ${(Number(item.qty) * Number(item.unitPrice)).toFixed(2)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(i)}
                    disabled={items.length <= 1}
                    data-testid={`button-remove-item-${i}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Tax Rate (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                data-testid="input-quote-tax"
              />
            </div>
            <div className="space-y-2">
              <Label>Discount ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                data-testid="input-quote-discount"
              />
            </div>
            <div className="space-y-1 pt-6">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax</span>
                <span>${totals.tax.toFixed(2)}</span>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span>-${totals.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold border-t pt-1">
                <span>Total</span>
                <span>${totals.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate("/quotes")}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save-quote">
              {saveMutation.isPending ? "Saving..." : isEditing ? "Update Quote" : "Create Quote"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

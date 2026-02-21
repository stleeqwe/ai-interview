'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { EvaluationJSON } from '@/lib/schemas/evaluation';

const PRIORITY_STYLES: Record<string, string> = {
  '높음': 'bg-red-100 text-red-800',
  '중간': 'bg-yellow-100 text-yellow-800',
};

interface ActionItemsProps {
  items: EvaluationJSON['action_items'];
}

export function ActionItems({ items }: ActionItemsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">개선 액션 아이템</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-4">
          {items.map((item, idx) => (
            <li key={idx} className="flex gap-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {idx + 1}
              </span>
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{item.area}</p>
                  <Badge variant="outline" className={PRIORITY_STYLES[item.priority] ?? ''}>
                    {item.priority}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{item.action}</p>
                <p className="text-xs text-muted-foreground/70 italic">{item.example}</p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

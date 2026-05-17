import { getDatabase, withTransaction } from "./schema";

export interface Entity {
  id: string;
  type: string;
  properties: Record<string, any>;
  weight: number;
  extractedAt?: number;
  lastAccessedAt?: number;
}

export interface Relation {
  id: string;
  source: string;
  target: string;
  type: string;
  weight: number;
  extractedAt?: number;
}

export interface ConnectedEntity {
  entity: Entity;
  distance: number;
  path: string[];
  weight: number;
}

export function addEntity(entity: Entity): void {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO entities (id, type, properties, weight, extractedAt, lastAccessedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    entity.id,
    entity.type,
    JSON.stringify(entity.properties),
    entity.weight,
    entity.extractedAt || Date.now(),
    Date.now()
  );
}

export function addRelation(relation: Relation): void {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO relations (id, source, target, type, weight, extractedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(relation.id, relation.source, relation.target, relation.type, relation.weight, relation.extractedAt || Date.now());
}

export function getEntity(entityId: string): Entity | null {
  const db = getDatabase();

  const stmt = db.prepare("SELECT * FROM entities WHERE id = ?");
  const record = stmt.get(entityId) as any;

  if (!record) return null;

  // Update lastAccessedAt
  const updateStmt = db.prepare("UPDATE entities SET lastAccessedAt = ? WHERE id = ?");
  updateStmt.run(Date.now(), entityId);

  return {
    id: record.id,
    type: record.type,
    properties: JSON.parse(record.properties),
    weight: record.weight,
    extractedAt: record.extractedAt,
    lastAccessedAt: record.lastAccessedAt,
  };
}

export function findConnected(entityId: string, maxDepth = 2): ConnectedEntity[] {
  const db = getDatabase();
  const results: ConnectedEntity[] = [];
  const visited = new Set<string>();

  // BFS queue: [entityId, distance, path, weight]
  const queue: Array<[string, number, string[], number]> = [[entityId, 0, [entityId], 1.0]];
  visited.add(entityId);

  while (queue.length > 0 && results.length < 100) {
    const [currentId, distance, path, pathWeight] = queue.shift()!;

    if (distance > 0 && distance <= maxDepth) {
      const entity = getEntity(currentId);
      if (entity) {
        results.push({
          entity,
          distance,
          path,
          weight: pathWeight,
        });
      }
    }

    if (distance < maxDepth) {
      // Find outgoing relations
      const relStmt = db.prepare("SELECT * FROM relations WHERE source = ? OR target = ?");
      const relations = relStmt.all(currentId, currentId) as any[];

      for (const rel of relations) {
        const nextId = rel.source === currentId ? rel.target : rel.source;

        if (!visited.has(nextId)) {
          visited.add(nextId);
          const newPath = [...path, nextId];
          const newWeight = pathWeight * rel.weight;
          queue.push([nextId, distance + 1, newPath, newWeight]);
        }
      }
    }
  }

  // Sort by weight descending
  return results.sort((a, b) => b.weight - a.weight);
}

export function getRelationsFor(entityId: string): Relation[] {
  const db = getDatabase();

  const stmt = db.prepare("SELECT * FROM relations WHERE source = ? OR target = ?");
  const records = stmt.all(entityId, entityId) as any[];

  return records.map((r) => ({
    id: r.id,
    source: r.source,
    target: r.target,
    type: r.type,
    weight: r.weight,
    extractedAt: r.extractedAt,
  }));
}

export function extractEntitiesFromText(text: string, userId: string): Entity[] {
  // Simple heuristic extraction - can be enhanced with NLP
  const entities: Entity[] = [];

  // Extract quoted terms as entities
  const quotedMatches = text.match(/"([^"]+)"/g);
  if (quotedMatches) {
    for (const match of quotedMatches) {
      const content = match.slice(1, -1);
      const entityId = `entity-${Date.now()}-${Math.random()}`;
      entities.push({
        id: entityId,
        type: "concept",
        properties: { text: content, source: "extraction", userId },
        weight: 0.5,
      });
    }
  }

  // Extract file paths as entities
  const pathMatches = text.match(/(?:\/|\\)[a-zA-Z0-9\.\-_\/\\]+/g);
  if (pathMatches) {
    for (const match of pathMatches) {
      const entityId = `entity-${Date.now()}-${Math.random()}`;
      entities.push({
        id: entityId,
        type: "file",
        properties: { path: match, userId },
        weight: 0.7,
      });
    }
  }

  // Extract error patterns
  const errorMatches = text.match(/(?:Error|Exception|TypeError|ReferenceError)[^.\n]*/gi);
  if (errorMatches) {
    for (const match of errorMatches) {
      const entityId = `entity-${Date.now()}-${Math.random()}`;
      entities.push({
        id: entityId,
        type: "error",
        properties: { message: match, userId },
        weight: 0.8,
      });
    }
  }

  return entities;
}

export function linkEntities(sourceId: string, targetId: string, relationType = "related_to", weight = 1.0): void {
  const relationId = `rel-${sourceId}-${targetId}-${Date.now()}`;

  addRelation({
    id: relationId,
    source: sourceId,
    target: targetId,
    type: relationType,
    weight,
  });
}

export function getStats(): {
  totalEntities: number;
  totalRelations: number;
  avgWeight: number;
} {
  const db = getDatabase();

  const entityStmt = db.prepare("SELECT COUNT(*) as count FROM entities");
  const relationStmt = db.prepare("SELECT COUNT(*) as count FROM relations");
  const weightStmt = db.prepare("SELECT AVG(weight) as avg FROM entities");

  return {
    totalEntities: (entityStmt.get() as { count: number }).count,
    totalRelations: (relationStmt.get() as { count: number }).count,
    avgWeight: (weightStmt.get() as { avg: number | null }).avg ?? 0,
  };
}

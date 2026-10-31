import {join} from 'node:path';
import type {ContentEdit, EditResult} from '@core/schema/contentEdit';
import {
  createServiceId,
  createTemplateId,
  type ServiceId,
  type TemplateId,
} from '@core/schema/ids';
import type {Service, Template} from '@core/schema/service';
import {copiedItems, pickedItems} from './contentEdits';
import type {ContentCommandContext, ContentHandlers} from './contentCommands';

const SCHEMA_VERSION = 1;
const SERVICE_EXTENSION = '.llservice';
const TIME_OF_DATE = /T(\d{2}:\d{2})$/;

type ServiceContentCommandsHandlers = Pick<
  ContentHandlers,
  Extract<ContentEdit['type'], `service.${string}` | `template.${string}`>
>;

class ServiceContentCommands {
  constructor(private readonly context: ContentCommandContext) {}

  readonly handlers: ServiceContentCommandsHandlers = {
    'service.create': edit => this.createService(edit),
    'service.update': edit =>
      this.updateService(edit.service, edit.baseRevision),
    'service.delete': edit => this.deleteService(edit.serviceId),
    'service.importItems': edit => this.importItems(edit),
    'service.saveAsTemplate': edit =>
      this.saveAsTemplate(edit.serviceId, edit.name),
    'template.update': edit =>
      this.updateTemplate(edit.template, edit.baseRevision),
    'template.delete': edit => this.deleteTemplate(edit.templateId),
  };

  private async createService({
    name,
    date,
    templateId,
  }: Extract<ContentEdit, {type: 'service.create'}>): Promise<EditResult> {
    const template =
      templateId === null ? null : this.context.templates.get(templateId);
    if (template === undefined) {
      return this.context.refuse(
        'not-found',
        `No 템플릿 has the id ${String(templateId)}`,
      );
    }
    const id = createServiceId(this.context.newId());
    const service: Service = {
      format: 'llservice',
      schemaVersion: SCHEMA_VERSION,
      id,
      name,
      date,
      order: template === null ? [] : copiedItems(template.data.order),
    };
    const file = join(
      this.context.locations.services,
      `${id}${SERVICE_EXTENSION}`,
    );
    const full = this.context.savesFull([file]);
    if (full !== null) return full;
    const stored = this.context.services.add(service, file);
    const written = await this.context.write(
      this.context.kinds.service,
      stored,
    );
    this.context.announceService(id);
    return this.context.answer({id, revision: stored.revision}, [written]);
  }

  private updateService(service: Service, baseRevision: number): EditResult {
    const checked = this.context.checkUpdate(
      this.context.services.get(service.id),
      baseRevision,
      service,
    );
    if (!checked.ok) {
      return checked.error;
    }
    const full = this.context.savesFull([checked.value.file]);
    if (full !== null) return full;
    const stored = this.context.services.replace(checked.value, {
      ...checked.value.data,
      ...service,
    });
    this.context.saveLater(
      this.context.kinds.service,
      this.context.services,
      service.id,
    );
    this.context.announceService(service.id);
    return {ok: true, value: {id: service.id, revision: stored.revision}};
  }

  private async deleteService(serviceId: ServiceId): Promise<EditResult> {
    if (serviceId === this.context.currentServiceId()) {
      return this.context.refuse(
        'invalid',
        'The open 예배 순서 cannot be deleted',
      );
    }
    const checked = this.context.checkEditable(
      this.context.services.get(serviceId),
    );
    if (!checked.ok) {
      return checked.error;
    }
    const full = this.context.savesFull([checked.value.file]);
    if (full !== null) return full;
    this.context.services.remove(serviceId);
    const written = await this.context.remove(
      this.context.kinds.service,
      checked.value,
    );
    this.context.announceService(serviceId);
    return this.context.answer({id: serviceId, revision: null}, [written]);
  }

  private async importItems({
    serviceId,
    from,
    itemIds,
  }: Extract<ContentEdit, {type: 'service.importItems'}>): Promise<EditResult> {
    const checked = this.context.checkEditable(
      this.context.services.get(serviceId),
    );
    if (!checked.ok) {
      return checked.error;
    }
    const source =
      from.kind === 'service'
        ? this.context.services.get(from.id)
        : this.context.templates.get(from.id);
    if (source === undefined) {
      return this.context.refuse(
        'not-found',
        `No ${from.kind} has the id ${from.id}`,
      );
    }
    const wanted = new Set<string>(itemIds);
    if (
      source.data.order.filter(({id}) => wanted.has(id)).length !== wanted.size
    ) {
      return this.context.refuse(
        'invalid',
        'An item to import is not in the source',
      );
    }
    const picked = pickedItems(source.data.order, wanted);
    const target = checked.value;
    const full = this.context.savesFull([target.file]);
    if (full !== null) return full;
    const stored = this.context.services.replace(target, {
      ...target.data,
      order: [...target.data.order, ...copiedItems(picked)],
    });
    const written = await this.context.write(
      this.context.kinds.service,
      stored,
    );
    this.context.announceService(serviceId);
    return this.context.answer({id: serviceId, revision: stored.revision}, [
      written,
    ]);
  }

  private async saveAsTemplate(
    serviceId: ServiceId,
    name: string,
  ): Promise<EditResult> {
    const service = this.context.services.get(serviceId);
    if (service === undefined) {
      return this.context.refuse(
        'not-found',
        `No 예배 순서 has the id ${serviceId}`,
      );
    }
    const id = createTemplateId(this.context.newId());
    const time = TIME_OF_DATE.exec(service.data.date)?.[1];
    const template: Template = {
      format: 'llservice',
      schemaVersion: SCHEMA_VERSION,
      id,
      name,
      ...(time === undefined ? {} : {time}),
      order: copiedItems(service.data.order),
    };
    const file = join(
      this.context.locations.templates,
      `${id}${SERVICE_EXTENSION}`,
    );
    const full = this.context.savesFull([file]);
    if (full !== null) return full;
    const stored = this.context.templates.add(template, file);
    const written = await this.context.write(
      this.context.kinds.template,
      stored,
    );
    this.context.announceTemplate(id);
    return this.context.answer({id, revision: stored.revision}, [written]);
  }

  private updateTemplate(template: Template, baseRevision: number): EditResult {
    const checked = this.context.checkUpdate(
      this.context.templates.get(template.id),
      baseRevision,
      template,
    );
    if (!checked.ok) {
      return checked.error;
    }
    const full = this.context.savesFull([checked.value.file]);
    if (full !== null) return full;
    const {time: _time, ...kept} = checked.value.data;
    const stored = this.context.templates.replace(checked.value, {
      ...kept,
      ...template,
    });
    this.context.saveLater(
      this.context.kinds.template,
      this.context.templates,
      template.id,
    );
    this.context.announceTemplate(template.id);
    return {ok: true, value: {id: template.id, revision: stored.revision}};
  }

  private async deleteTemplate(templateId: TemplateId): Promise<EditResult> {
    const checked = this.context.checkEditable(
      this.context.templates.get(templateId),
    );
    if (!checked.ok) {
      return checked.error;
    }
    const full = this.context.savesFull([checked.value.file]);
    if (full !== null) return full;
    this.context.templates.remove(templateId);
    const written = await this.context.remove(
      this.context.kinds.template,
      checked.value,
    );
    this.context.announceTemplate(templateId);
    return this.context.answer({id: templateId, revision: null}, [written]);
  }
}

/**
 * Builds service and template handlers over live store ports. The facade owns
 * serialization and exception reporting; handlers keep no document copies.
 */
export function createServiceContentCommands(
  context: ContentCommandContext,
): ServiceContentCommandsHandlers {
  return new ServiceContentCommands(context).handlers;
}

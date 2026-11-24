<script setup>
// 内容颜色规则表格：设置页「日志内容颜色」与日志窗口「颜色」弹窗共用的规则列表。
// items 由父组件传入（globalColorRulesView 或 combinedColorRules）；sessionAware=true 时
// 启用「是否生效」列与「本会话/全局」作用域差异（global 行只读、带左色条样式）。
import * as State from '@/composables/state'
import { onRuleChange, onRuleHexInput, onRuleBgInput, openEditColorRule, deleteColorRuleItem, ruleEnabled, onToggleEnabled } from '@/composables/useColorrules'
import { t } from '@/i18n'

const { activeLogSerial } = State

defineProps({
  items: { type: Array, required: true },
  sessionAware: { type: Boolean, default: false }
})
</script>

<template>
  <table class="cc-table">
    <thead>
      <tr>
        <th>{{ t('modal.colorKeyword') }}</th><th>Tag</th><th>{{ t('log.content') }}</th><th>{{ t('common.color') }}</th><th>{{ t('modal.bgColor') }}</th><th>{{ t('common.bold') }}</th>
        <th v-if="sessionAware">{{ t('modal.enabled') }}</th>
        <th>{{ t('common.operation') }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(item, idx) in items" :key="idx" :class="{ 'cc-row-session': sessionAware && item.scope === 'session' }">
        <td class="cc-kw">{{ item.rule.keyword }}</td>
        <td class="cc-chk"><input type="checkbox" v-model="item.rule.byTag" :disabled="sessionAware && item.scope === 'global'" @change="onRuleChange(item)" /></td>
        <td class="cc-chk"><input type="checkbox" v-model="item.rule.byMsg" :disabled="sessionAware && item.scope === 'global'" @change="onRuleChange(item)" /></td>
        <td>
          <div class="cc-color">
            <input type="color" v-model="item.rule.color" :disabled="!item.rule.bgOn || (sessionAware && item.scope === 'global')" @change="onRuleChange(item)" />
            <input type="text" class="color-hex-input" :value="item.rule.color" :disabled="!item.rule.bgOn || (sessionAware && item.scope === 'global')" @input="onRuleHexInput(item, $event.target.value)" maxlength="7" spellcheck="false" />
          </div>
        </td>
        <td>
          <div class="cc-color">
            <input type="color" v-model="item.rule.bgColor" :disabled="!item.rule.bgOn || (sessionAware && item.scope === 'global')" @change="onRuleChange(item)" />
            <input type="text" class="color-hex-input" :value="item.rule.bgColor" :disabled="!item.rule.bgOn || (sessionAware && item.scope === 'global')" @input="onRuleBgInput(item, $event.target.value)" maxlength="7" spellcheck="false" />
            <label class="cc-bg-on"><input type="checkbox" v-model="item.rule.bgOn" :disabled="sessionAware && item.scope === 'global'" @change="onRuleChange(item)" />{{ t('common.enable') }}</label>
          </div>
        </td>
        <td class="cc-chk"><input type="checkbox" v-model="item.rule.bold" :disabled="sessionAware && item.scope === 'global'" @change="onRuleChange(item)" /></td>
        <td v-if="sessionAware" class="cc-chk"><input type="checkbox" :checked="ruleEnabled(item)" @change="onToggleEnabled(item, $event.target.checked)" /></td>
        <td class="cc-ops">
          <template v-if="sessionAware && item.scope === 'session'"><button class="cc-edit" @click="openEditColorRule(item)">{{ t('common.edit') }}</button><button class="cc-del" @click="deleteColorRuleItem(item)">{{ t('common.delete') }}</button></template>
          <template v-else-if="!sessionAware"><button class="cc-edit" @click="openEditColorRule(item)">{{ t('common.edit') }}</button><button class="cc-del" @click="deleteColorRuleItem(item)">{{ t('common.delete') }}</button></template>
          <span v-else class="muted small">{{ t('modal.global') }}</span>
        </td>
      </tr>
      <tr v-if="!items.length"><td :colspan="sessionAware ? 8 : 7" class="muted">{{ t('modal.noColorRules') }}</td></tr>
    </tbody>
  </table>
</template>

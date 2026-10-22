<script setup lang="ts">
import { ZIconButton, ZInput } from '@codex-proxy/ui'

import { RefreshCw, Search } from '@lucide/vue'

import { useI18n } from 'vue-i18n'

defineProps<{
  refreshing: boolean
  loading: boolean
}>()

const emit = defineEmits<{
  refresh: []
}>()

const { t } = useI18n({ useScope: 'global' })

const search = defineModel<string>('search', { required: true })
</script>

<template>
  <div class="flex w-full flex-wrap items-center gap-3" role="group" :aria-label="t('usage.filters.label')">
    <div class="w-full min-w-0 sm:w-96 sm:flex-none">
      <ZInput v-model="search" :placeholder="t('usage.filters.keyNameAccountOrModel')" :aria-label="t('usage.filters.searchLabel')" class="w-full">
        <template #prefix>
          <Search class="size-4.5 text-cp-text-tertiary" />
        </template>
      </ZInput>
    </div>

    <div class="ml-auto flex shrink-0 items-center justify-end gap-2">
      <slot name="actions" />
      <ZIconButton
        size="default"
        :aria-label="t('usage.filters.refreshUsageHistory')"
        :loading="refreshing"
        :disabled="loading || refreshing"
        @click="emit('refresh')"
      >
        <template #loading>
          <RefreshCw class="size-4.5 animate-spin motion-reduce:animate-none" />
        </template>
        <RefreshCw class="size-4.5" />
      </ZIconButton>
    </div>
  </div>
</template>

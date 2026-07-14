{{- define "connectsphere.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "connectsphere.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "connectsphere.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "connectsphere.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "connectsphere.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{- define "connectsphere.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/name: {{ include "connectsphere.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- with .Values.global.labels }}
{{ toYaml . }}
{{- end }}
{{- end -}}

{{- define "connectsphere.selectorLabels" -}}
app.kubernetes.io/name: {{ include "connectsphere.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "connectsphere.image" -}}
{{- $root := index . "root" -}}
{{- $name := index . "name" -}}
{{- $service := index . "service" -}}
{{- $registry := required "global.image.registry is required" $root.Values.global.image.registry | trimSuffix "/" -}}
{{- $prefix := $root.Values.global.image.repositoryPrefix | default "" | trimAll "/" -}}
{{- $repository := default $name $service.image.repository -}}
{{- $tag := default $root.Values.global.image.tag $service.image.tag | default $root.Chart.AppVersion -}}
{{- if and (eq ($root.Values.config.data.NODE_ENV | default "development") "production") (or (contains "changeme" $registry) (eq $tag "latest")) -}}
{{- fail "production images require a non-placeholder registry and immutable non-latest tag" -}}
{{- end -}}
{{- if $prefix -}}
{{- printf "%s/%s/%s:%s" $registry $prefix $repository $tag -}}
{{- else -}}
{{- printf "%s/%s:%s" $registry $repository $tag -}}
{{- end -}}
{{- end -}}

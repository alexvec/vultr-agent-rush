# Sandbox image for Padded Cell. Base pinned by digest. Standard library Python only.
FROM alpine:3.22@sha256:2e0b81d60597f449baa56dc25d355367869d2dca4cd57e866f1e2b52af3eb55f
RUN apk add --no-cache python3 \
 && rm -rf /sbin/apk /etc/apk /lib/apk /var/cache/apk /usr/lib/python3*/ensurepip \
 && find / -xdev -perm /6000 -type f -exec chmod a-s {} + \
 && mkdir -p /input /code /opt/cell
COPY runner.py probe.py /opt/cell/
RUN chmod 0444 /opt/cell/runner.py /opt/cell/probe.py
USER 65534:65534
WORKDIR /tmp

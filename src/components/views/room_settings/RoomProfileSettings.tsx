/*
Copyright 2019 New Vector Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { createRef } from 'react';
import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import Field from "../elements/Field";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import { mediaFromMxc } from "../../../customisations/Media";
import AccessibleButton from "../elements/AccessibleButton";
import AvatarSetting from "../settings/AvatarSetting";

interface IProps {
    roomId: string;
}

interface IState {
    originalDisplayName: string;
    displayName: string;
    originalAvatarUrl: string;
    avatarUrl: string;
    avatarFile: File;
    originalTopic: string;
    topic: string;
    enableProfileSave: boolean;
    canSetName: boolean;
    canSetTopic: boolean;
    canSetAvatar: boolean;
}

// TODO: Merge with ProfileSettings?
@replaceableComponent("views.room_settings.RoomProfileSettings")
export default class RoomProfileSettings extends React.Component<IProps, IState> {
    private avatarUpload = createRef<HTMLInputElement>();

    constructor(props: IProps) {
        super(props);

        const client = MatrixClientPeg.get();
        const room = client.getRoom(props.roomId);
        if (!room) throw new Error(`Expected a room for ID: ${props.roomId}`);

        const avatarEvent = room.currentState.getStateEvents("m.room.avatar", "");
        let avatarUrl = avatarEvent && avatarEvent.getContent() ? avatarEvent.getContent()["url"] : null;
        if (avatarUrl) avatarUrl = mediaFromMxc(avatarUrl).getSquareThumbnailHttp(96);

        const topicEvent = room.currentState.getStateEvents("m.room.topic", "");
        const topic = topicEvent && topicEvent.getContent() ? topicEvent.getContent()['topic'] : '';

        const nameEvent = room.currentState.getStateEvents('m.room.name', '');
        const name = nameEvent && nameEvent.getContent() ? nameEvent.getContent()['name'] : '';

        this.state = {
            originalDisplayName: name,
            displayName: name,
            originalAvatarUrl: avatarUrl,
            avatarUrl: avatarUrl,
            avatarFile: null,
            originalTopic: topic,
            topic: topic,
            enableProfileSave: false,
            canSetName: room.currentState.maySendStateEvent('m.room.name', client.getUserId()),
            canSetTopic: room.currentState.maySendStateEvent('m.room.topic', client.getUserId()),
            canSetAvatar: room.currentState.maySendStateEvent('m.room.avatar', client.getUserId()),
        };
    }

    private uploadAvatar = (): void => {
        this.avatarUpload.current.click();
    };

    private removeAvatar = (): void => {
        // clear file upload field so same file can be selected
        this.avatarUpload.current.value = "";
        this.setState({
            avatarUrl: null,
            avatarFile: null,
            enableProfileSave: true,
        });
    };

    private cancelProfileChanges = async (e: React.MouseEvent): Promise<void> => {
        e.stopPropagation();
        e.preventDefault();

        if (!this.state.enableProfileSave) return;
        this.setState({
            enableProfileSave: false,
            displayName: this.state.originalDisplayName,
            topic: this.state.originalTopic,
            avatarUrl: this.state.originalAvatarUrl,
            avatarFile: null,
        });
    };

    private saveProfile = async (e: React.FormEvent): Promise<void> => {
        e.stopPropagation();
        e.preventDefault();

        if (!this.state.enableProfileSave) return;
        this.setState({ enableProfileSave: false });

        const client = MatrixClientPeg.get();

        let originalDisplayName: string;
        let avatarUrl: string;
        let originalAvatarUrl: string;
        let originalTopic: string;
        let avatarFile: File;

        // TODO: What do we do about errors?
        const displayName = this.state.displayName.trim();
        if (this.state.originalDisplayName !== this.state.displayName) {
            await client.setRoomName(this.props.roomId, displayName);
            originalDisplayName = displayName;
        }

        if (this.state.avatarFile) {
            const uri = await client.uploadContent(this.state.avatarFile);
            await client.sendStateEvent(this.props.roomId, 'm.room.avatar', { url: uri }, '');
            avatarUrl = mediaFromMxc(uri).getSquareThumbnailHttp(96);
            originalAvatarUrl = avatarUrl;
            avatarFile = null;
        } else if (this.state.originalAvatarUrl !== this.state.avatarUrl) {
            await client.sendStateEvent(this.props.roomId, 'm.room.avatar', {}, '');
        }

        if (this.state.originalTopic !== this.state.topic) {
            await client.setRoomTopic(this.props.roomId, this.state.topic);
            originalTopic = this.state.topic;
        }

        this.setState({
            originalAvatarUrl,
            avatarUrl,
            originalDisplayName,
            originalTopic,
            displayName,
            avatarFile,
        });
    };

    private onDisplayNameChanged = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({ displayName: e.target.value });
        if (this.state.originalDisplayName === e.target.value) {
            this.setState({ enableProfileSave: false });
        } else {
            this.setState({ enableProfileSave: true });
        }
    };

    private onTopicChanged = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
        this.setState({ topic: e.target.value });
        if (this.state.originalTopic === e.target.value) {
            this.setState({ enableProfileSave: false });
        } else {
            this.setState({ enableProfileSave: true });
        }
    };

    private onAvatarChanged = (e: React.ChangeEvent<HTMLInputElement>): void => {
        if (!e.target.files || !e.target.files.length) {
            this.setState({
                avatarUrl: this.state.originalAvatarUrl,
                avatarFile: null,
                enableProfileSave: false,
            });
            return;
        }

        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
            this.setState({
                avatarUrl: String(ev.target.result),
                avatarFile: file,
                enableProfileSave: true,
            });
        };
        reader.readAsDataURL(file);
    };

    public render(): JSX.Element {
        let profileSettingsButtons;
        if (
            this.state.canSetName ||
            this.state.canSetTopic ||
            this.state.canSetAvatar
        ) {
            profileSettingsButtons = (
                <div className="mx_ProfileSettings_buttons">
                    <AccessibleButton
                        onClick={this.cancelProfileChanges}
                        kind="link"
                        disabled={!this.state.enableProfileSave}
                    >
                        { _t("Cancel") }
                    </AccessibleButton>
                    <AccessibleButton
                        onClick={this.saveProfile}
                        kind="primary"
                        disabled={!this.state.enableProfileSave}
                    >
                        { _t("Save") }
                    </AccessibleButton>
                </div>
            );
        }

        return (
            <form
                onSubmit={this.saveProfile}
                autoComplete="off"
                noValidate={true}
                className="mx_ProfileSettings_profileForm"
            >
                <input
                    type="file"
                    ref={this.avatarUpload}
                    className="mx_ProfileSettings_avatarUpload"
                    onChange={this.onAvatarChanged}
                    accept="image/*"
                />
                <div className="mx_ProfileSettings_profile">
                    <div className="mx_ProfileSettings_controls">
                        <Field
                            label={_t("Room Name")}
                            type="text"
                            value={this.state.displayName}
                            autoComplete="off"
                            onChange={this.onDisplayNameChanged}
                            disabled={!this.state.canSetName}
                        />
                        <Field
                            className="mx_ProfileSettings_controls_topic"
                            id="profileTopic"
                            label={_t("Room Topic")}
                            disabled={!this.state.canSetTopic}
                            type="text"
                            value={this.state.topic}
                            autoComplete="off"
                            onChange={this.onTopicChanged}
                            element="textarea"
                        />
                    </div>
                    <AvatarSetting
                        avatarUrl={this.state.avatarUrl}
                        avatarName={this.state.displayName || this.props.roomId}
                        avatarAltText={_t("Room avatar")}
                        uploadAvatar={this.state.canSetAvatar ? this.uploadAvatar : undefined}
                        removeAvatar={this.state.canSetAvatar ? this.removeAvatar : undefined} />
                </div>
                { profileSettingsButtons }
            </form>
        );
    }
}
